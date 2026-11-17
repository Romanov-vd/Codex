/* Autonomous preview only. Real server API remains unchanged. */
(() => {
  const catalog = window.CLINIC_LOCAL_CATALOG;
  const databaseName='liniya-autonomous-v1',storageKey='liniya-local-state-v1',sessionKey='liniya-local-session-v1';
  let dbPromise,queue=Promise.resolve();
  const uuid=()=>crypto.randomUUID();
  const now=()=>new Date().toISOString();
  const cleanUser=u=>({id:u.id,name:u.name,email:u.email,phone:u.phone,role:u.role});
  const problem=(status,message,code)=>{const e=Error(message);e.status=status;e.code=code;throw e;};
  const value=(v,min=0,max=200)=>{if(typeof v!=='string'||v.trim().length<min||v.trim().length>max)problem(400,'Проверьте заполненные поля.');return v.trim();};
  const address=v=>{const a=value(v,5,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a))problem(400,'Введите корректный email.');return a;};
  const phone=v=>{const a=value(v,0,30);if(a&&(!/^[+\d\s()\-]+$/.test(a)||a.replace(/\D/g,'').length<10||a.replace(/\D/g,'').length>15))problem(400,'Проверьте номер телефона.');return a;};
  async function hash(password,salt){
    salt=salt||Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
    const bytes=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:120000},key,256);
    return salt+':'+Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
  }
  function open(){
    if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{const request=indexedDB.open(databaseName,1);request.onupgradeneeded=()=>request.result.createObjectStore('state');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    return dbPromise;
  }
  async function transaction(change){
    const db=await open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('state',change?'readwrite':'readonly');const store=tx.objectStore('state');const request=store.get('current');let result;
      request.onsuccess=()=>{try{const state=request.result||{users:[],appointments:[],callbacks:[]};result=change?change(state):state;if(change)store.put(state,'current');}catch(error){reject(error);tx.abort();}};
      tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error||Error('Не удалось сохранить данные.'));tx.onabort=()=>reject(tx.error||Error('Сохранение прервано.'));
    });
  }
  const initialization=(async()=>{const adminPassword=await hash('ClinicDemo2026!');await transaction(state=>{if(!state.users.some(u=>u.email==='admin@local.test'))state.users.push({id:uuid(),name:'Демо-администратор',email:'admin@local.test',phone:'',role:'admin',password:adminPassword,created_at:now()});});})();
  initialization.catch(()=>{});
  const decorate=a=>({...a,doctor:catalog.doctors.find(d=>d.id===a.doctor_id),service:catalog.services.find(s=>s.id===a.service_id)});
  const moscowDate=date=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
  const days=n=>moscowDate(new Date(Date.now()+n*86400000));
  function slots(doctor,date){
    if(!catalog.doctors.some(d=>d.id===doctor)||typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return [];
    const stamp=new Date(date+'T12:00:00+03:00');
    if(!Number.isFinite(stamp.valueOf())||moscowDate(stamp)!==date||date<days(0)||date>days(30)||stamp.getUTCDay()===0)return [];
    return ['09:00','10:00','11:00','12:00','14:00','15:00','16:00','17:00'].map(t=>date+'T'+t+':00+03:00').filter(t=>Date.parse(t)>Date.now()+3600000);
  }
  function details(body){const doctor=catalog.doctors.find(d=>d.id===body.doctorId),service=catalog.services.find(s=>s.id===body.serviceId);if(!doctor||!service||!doctor.serviceIds.includes(service.id))problem(400,'Выбранный врач не оказывает эту услугу.');const time=value(body.startsAt,25,25);if(!slots(doctor.id,time.slice(0,10)).includes(time))problem(400,'Это время недоступно.');return {doctor,service,time};}
  async function handle(path,options){
    if(options.signal?.aborted)throw new DOMException('Aborted','AbortError');
    const url=new URL('https://local.invalid/api/'+path),route=url.pathname.slice(5),method=options.method||'GET',body=options.body||{};
    if(route==='catalog')return {services:catalog.services,doctors:catalog.doctors};
    await initialization;
    const state=await transaction(),sessionId=sessionStorage.getItem(sessionKey),user=state.users.find(u=>u.id===sessionId);
    if(route==='auth/me')return {user:user?cleanUser(user):null};
    if(route==='auth/logout'){sessionStorage.removeItem(sessionKey);return {ok:true};}
    if(route==='auth/register'&&method==='POST'){
      const email=address(body.email),name=value(body.name,2,100),mobile=phone(body.phone||'');
      if(body.consent!==true)problem(400,'Нужно согласие на обработку данных.');
      if(typeof body.password!=='string'||body.password.length<10||body.password.length>256)problem(400,'Пароль должен содержать от 10 до 256 символов.');
      const password=await hash(body.password);const account={id:uuid(),name,email,phone:mobile,password,role:'patient',created_at:now()};
      await transaction(s=>{if(s.users.some(u=>u.email===email))problem(409,'Этот email уже зарегистрирован.');s.users.push(account);});
      sessionStorage.setItem(sessionKey,account.id);return {user:cleanUser(account)};
    }
    if(route==='auth/login'&&method==='POST'){
      const email=address(body.email);if(typeof body.password!=='string'||body.password.length>256)problem(400,'Введите пароль.');
      const account=state.users.find(u=>u.email===email);
      if(!account||await hash(body.password,account.password.split(':')[0])!==account.password)problem(401,'Неверный email или пароль.');
      sessionStorage.setItem(sessionKey,account.id);return {user:cleanUser(account)};
    }
    if(route==='slots'){
      const doctorId=url.searchParams.get('doctorId'),date=url.searchParams.get('date');
      return {slots:slots(doctorId,date).map(startsAt=>({startsAt,available:!state.appointments.some(a=>a.doctor_id===doctorId&&a.starts_at===startsAt&&a.status==='confirmed')}))};
    }
    if(route==='callbacks'&&method==='POST'){
      const name=value(body.name,2,100),mobile=phone(body.phone),message=value(body.message||'',0,1000);
      if(!mobile||body.consent!==true)problem(400,'Укажите телефон и согласие.');
      await transaction(s=>s.callbacks.push({id:uuid(),name,phone:mobile,message,created_at:now()}));return {ok:true};
    }
    if(!user)problem(401,'Войдите в личный кабинет.','AUTH_REQUIRED');
    if(route==='profile'&&method==='PATCH'){
      const name=value(body.name,2,100),mobile=phone(body.phone||'');
      await transaction(s=>{const account=s.users.find(u=>u.id===user.id);account.name=name;account.phone=mobile;});return {user:{...cleanUser(user),name,phone:mobile}};
    }
    if(route==='appointments'&&method==='GET')return {appointments:state.appointments.filter(a=>a.user_id===user.id).sort((a,b)=>b.starts_at.localeCompare(a.starts_at)).map(decorate)};
    if(route==='appointments'&&method==='POST'){
      const{doctor,service,time}=details(body),appointment={id:uuid(),user_id:user.id,doctor_id:doctor.id,service_id:service.id,starts_at:time,status:'confirmed',created_at:now()};
      await transaction(s=>{if(s.appointments.some(a=>a.doctor_id===doctor.id&&a.starts_at===time&&a.status==='confirmed'))problem(409,'Это время уже заняли.','SLOT_TAKEN');s.appointments.push(appointment);});return {appointment:decorate(appointment)};
    }
    const match=route.match(/^appointments\/([a-f0-9-]{36})$/);
    if(match&&method==='PATCH'){
      await transaction(s=>{
        const a=s.appointments.find(a=>a.id===match[1]&&a.user_id===user.id);if(!a)problem(404,'Запись не найдена.');
        if(a.status!=='confirmed'||Date.parse(a.starts_at)<=Date.now())problem(409,'Эту запись уже нельзя изменить.');
        if(body.action==='cancel'){a.status='cancelled';return;}
        if(body.action!=='reschedule')problem(400,'Неизвестное действие.');
        const{time}=details({...body,doctorId:a.doctor_id,serviceId:a.service_id});
        if(s.appointments.some(b=>b.id!==a.id&&b.doctor_id===a.doctor_id&&b.starts_at===time&&b.status==='confirmed'))problem(409,'Это время уже заняли.','SLOT_TAKEN');a.starts_at=time;
      });return {ok:true};
    }
    if(route.startsWith('admin/')){
      if(user.role!=='admin')problem(403,'Недостаточно прав.');
      if(route==='admin/appointments')return {appointments:state.appointments.map(a=>{const patient=state.users.find(u=>u.id===a.user_id);return {...decorate(a),patient_name:patient?.name,patient_email:patient?.email,patient_phone:patient?.phone};}).sort((a,b)=>b.starts_at.localeCompare(a.starts_at))};
      if(route==='admin/callbacks')return {callbacks:[...state.callbacks].sort((a,b)=>b.created_at.localeCompare(a.created_at))};
      const match=route.match(/^admin\/appointments\/([a-f0-9-]{36})$/);
      if(match&&method==='PATCH'&&body.action==='cancel'){await transaction(s=>{const a=s.appointments.find(a=>a.id===match[1]&&a.status==='confirmed');if(!a)problem(404,'Запись не найдена.');a.status='cancelled';});return {ok:true};}
    }
    problem(404,'Страница не найдена.');
  }
  window.clinicLocalAPI=(path,options={})=>{
    const work=async()=>{try{return new Response(JSON.stringify(await handle(path,options)),{status:200,headers:{'Content-Type':'application/json'}});}catch(e){if(e.name==='AbortError')throw e;return new Response(JSON.stringify({error:e.status?e.message:'Не удалось открыть локальное хранилище. Разрешите сохранение данных в браузере.',code:e.code||'LOCAL_STORAGE_ERROR'}),{status:e.status||503,headers:{'Content-Type':'application/json'}});}};
    const result=queue.then(work,work);queue=result.then(()=>{},()=>{});return result;
  };
})();
