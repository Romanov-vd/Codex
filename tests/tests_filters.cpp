#include "doctest.h"
#include "Filters.h"
#include "stb_image.h"
#include "stb_image_write.h"
#include <filesystem>
#include <cmath>
#include <limits>

namespace {
int at(const Image& image, int x, int y) {
    int r = 0, g = 0, b = 0;
    image.getColor(x,y,r,g,b);
    return r;
}
Image uniform(int value) {
    Image image(7,7,1);
    for (int y = 0; y < 7; ++y)
        for (int x = 0; x < 7; ++x) image.setColor(x,y,value,0,0);
    return image;
}
}

TEST_CASE("Constant field: filters preserve brightness including boundaries") {
    using namespace Filters;
    const Image input = uniform(90);
    for (auto filter : {laplaceEdges, robertsEdges, sobelEdges}) {
        const Image result = filter(input);
        for (int y = 0; y < 7; ++y)
            for (int x = 0; x < 7; ++x) CHECK(at(result,x,y) == 0);
    }
    for (double sigma : {0.0,1.0}) {
        const Image result = sigma == 0 ? meanFilter(input,5) : gaussianFilter(input,5,sigma);
        for (int y = 0; y < 7; ++y)
            for (int x = 0; x < 7; ++x) CHECK(at(result,x,y) == 90);
    }
}

TEST_CASE("Vertical step: hand-computed edge responses") {
    using namespace Filters;
    Image input(7,7,1);
    for (int y = 0; y < 7; ++y)
        for (int x = 3; x < 7; ++x) input.setColor(x,y,40,0,0);
    CHECK(at(laplaceEdges(input),2,3) == 40);
    CHECK(at(robertsEdges(input),2,3) == 57);
    CHECK(at(sobelEdges(input),2,3) == 160);
    CHECK(at(sobelEdges(input),0,3) == 0);
}

TEST_CASE("Impulse: arithmetic and Gaussian results") {
    using namespace Filters;
    Image impulse = uniform(0);
    impulse.setColor(3,3,255,0,0);
    CHECK(at(meanFilter(impulse,3),3,3) == 28);
    CHECK(at(gaussianFilter(impulse,3,1.0),3,3) == 52);
}

TEST_CASE("Gray conversion and invalid filter arguments") {
    using namespace Filters;
    Image rgb(1,1,3);
    rgb.setColor(0,0,255,0,0);
    CHECK(at(convertToGrayscale(rgb),0,0) == 76);
    Image gray = uniform(70);
    CHECK_THROWS_AS(meanFilter(gray,2),std::invalid_argument);
    CHECK_THROWS_AS(gaussianFilter(gray,3,-1),std::invalid_argument);
    CHECK_THROWS_AS(gaussianFilter(gray,3,0),std::invalid_argument);
    CHECK_THROWS_AS(sobelEdges(Image()),std::invalid_argument);
}

TEST_CASE("Copy assignment, empty copy and no-op access") {
    Image a = uniform(30), b(1,1,3);
    b = a;
    a.setColor(1,1,80,0,0);
    CHECK(at(b,1,1) == 30);
    b = b;
    CHECK(at(b,1,1) == 30);
    int r = 11, g = 22, blue = 33;
    b.getColor(-1,0,r,g,blue);
    CHECK(r == 11);
    CHECK(g == 22);
    CHECK(blue == 33);
    b = Image();
    Image c(b);
    CHECK(c.width() == 0);
    CHECK_FALSE(c.isWrite("test_output/empty.png"));
    CHECK_THROWS_AS(Image(1,1,5),std::invalid_argument);
    CHECK_THROWS_AS(Image(0,1,3),std::invalid_argument);
}

TEST_CASE("PNG round trip preserves gray-alpha and RGBA alpha") {
    std::filesystem::create_directories("test_output");
    for (int channels : {2,4}) {
        const unsigned char data[] = {70,80,90,37};
        const std::string path = "test_output/alpha" + std::to_string(channels) + ".png";
        REQUIRE(stbi_write_png(path.c_str(),1,1,channels,data,channels) != 0);
        Image image(path);
        image.setColor(0,0,20,30,40);
        REQUIRE(image.isWrite(path));
        int w, h, n;
        unsigned char* raw = stbi_load(path.c_str(),&w,&h,&n,0);
        REQUIRE(raw != nullptr);
        CHECK(n == channels);
        CHECK(raw[0] == 20);
        CHECK(raw[channels-1] == data[channels-1]);
        stbi_image_free(raw);
        CHECK_FALSE(image.isRead("test_output/missing_image.png"));
        CHECK(at(image,0,0) == 20);
    }
}

TEST_CASE("Rank filters: hand-computed borders and independent output") {
    using namespace Filters;
    Image input(3,3,1);
    for (int y=0;y<3;++y)
        for (int x=0;x<3;++x) input.setColor(x,y,10*(1+x+3*y),0,0);
    const Image median = medianFilter(input,3);
    const int expected[3][3] = {{20,30,30},{40,50,60},{70,70,80}};
    for (int y=0;y<3;++y)
        for (int x=0;x<3;++x) {
            CHECK(at(median,x,y) == expected[y][x]);
            CHECK(at(input,x,y) == 10*(1+x+3*y));
        }
    CHECK(at(minimumFilter(input,3),0,0) == 10);
    CHECK(at(maximumFilter(input,3),0,0) == 50);
    CHECK(at(minimumFilter(input,5),1,1) == 10);
    CHECK(at(maximumFilter(input,5),1,1) == 90);
    CHECK(at(medianFilter(input,5),0,0) == 30);
}

TEST_CASE("Rank filters: impulses, single pixel and invalid windows") {
    using namespace Filters;
    Image bright=uniform(0), dark=uniform(100);
    bright.setColor(3,3,255,0,0);
    dark.setColor(3,3,0,0,0);
    for (int size : {3,5}) {
        CHECK(at(medianFilter(bright,size),3,3) == 0);
        CHECK(at(minimumFilter(bright,size),3,3) == 0);
        CHECK(at(maximumFilter(bright,size),3,3) == 255);
        CHECK(at(medianFilter(dark,size),3,3) == 100);
        CHECK(at(minimumFilter(dark,size),3,3) == 0);
        CHECK(at(maximumFilter(dark,size),3,3) == 100);
    }
    Image rgb(1,1,3);
    rgb.setColor(0,0,255,0,0);
    for (auto filter : {medianFilter,minimumFilter,maximumFilter}) {
        CHECK(at(filter(rgb,5),0,0) == 76);
        CHECK_THROWS_AS(filter(Image(),3),std::invalid_argument);
        for (int size : {0,2,33}) CHECK_THROWS_AS(filter(bright,size),std::invalid_argument);
    }
}

TEST_CASE("Metrics, clamping and extreme Gaussian sigma") {
    using namespace Filters;
    Image a=uniform(10),b=uniform(20);
    CHECK(calculateMSE(a,b) == 100);
    CHECK(calculatePSNR(a,b) == doctest::Approx(28.1308036));
    CHECK(std::isinf(calculatePSNR(a,a)));
    CHECK_THROWS_AS(calculateMSE(a,Image(1,1,1)),std::invalid_argument);
    CHECK_THROWS_AS(calculateMSE(Image(),Image()),std::invalid_argument);
    Image color(1,1,3);
    color.setColor(0,0,300,-2,50);
    int r=0,g=0,blue=0;
    color.getColor(0,0,r,g,blue);
    CHECK(r == 255);
    CHECK(g == 0);
    CHECK(blue == 50);
    Image impulse=uniform(0);
    impulse.setColor(3,3,255,0,0);
    CHECK(at(gaussianFilter(impulse,3,1e-200),3,3) == 255);
    CHECK(at(gaussianFilter(impulse,3,1e-200),2,3) == 0);
    CHECK_THROWS_AS(gaussianFilter(a,3,std::numeric_limits<double>::infinity()),std::invalid_argument);
}
