#include "Filters.h"
#include <algorithm>
#include <cmath>
#include <filesystem>
#include <iostream>
#include <limits>
#include <random>

#ifdef _WIN32
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#endif

namespace fs = std::filesystem;

namespace {
void saveImage(const Image& image, const fs::path& path) {
    if (!image.isWrite(path.string()))
        throw std::runtime_error("Cannot save: " + path.string());
}

// Дополнительный случайный тест. Изображения для отчёта подготовлены редактором.
fs::path generateRandomTest(unsigned seed) {
    constexpr int width = 320, height = 224;
    Image clean(width, height, 1);
    std::mt19937 generator(seed);
    for (int y = 0; y < height; ++y)
        for (int x = 0; x < width; ++x)
            clean.setColor(x, y, 45 + 130 * x / (width - 1), 0, 0);

    std::uniform_int_distribution<int> left(15, width - 80);
    std::uniform_int_distribution<int> top(15, height - 85);
    std::uniform_int_distribution<int> size(20, 65);
    std::uniform_int_distribution<int> brightness(30, 225);
    for (int object = 0; object < 6; ++object) {
        const int x0 = left(generator), y0 = top(generator);
        const int w = size(generator), h = size(generator);
        const int value = brightness(generator);
        for (int y = y0; y < y0 + h; ++y)
            for (int x = x0; x < x0 + w; ++x)
                clean.setColor(x, y, value, 0, 0);
    }
    // Тонкие штрихи позволяют заметить потерю деталей после усреднения.
    for (int x = 16; x < width - 16; x += 8)
        for (int y = height - 25; y < height - 10; ++y)
            clean.setColor(x, y, 235, 0, 0);

    Image noisy(clean);
    std::normal_distribution<double> noise(0.0, 18.0);
    for (int y = 0; y < height; ++y)
        for (int x = 0; x < width; ++x) {
            int r = 0, g = 0, b = 0;
            clean.getColor(x, y, r, g, b);
            const int value = std::clamp(static_cast<int>(std::lround(r + noise(generator))), 0, 255);
            noisy.setColor(x, y, value, 0, 0);
        }

    const fs::path directory = fs::path("test_input/generated") / std::to_string(seed);
    fs::create_directories(directory);
    saveImage(clean, directory / "clean.png");
    saveImage(noisy, directory / "noisy.png");
    std::cout << "\nДополнительный случайный тест, seed = " << seed
              << "\nЧистая картинка: " << (directory / "clean.png").string()
              << "\nКартинка с шумом: " << (directory / "noisy.png").string()
              << "\nДля отчёта используются отдельные изображения с шумом из редактора.\n";
    return directory / "noisy.png";
}

unsigned readSeed(const std::string& text) {
    if (text.empty() || text.find_first_not_of("0123456789") != std::string::npos)
        throw std::invalid_argument("Seed must be an integer from 0 to 4294967295");
    size_t end = 0;
    const auto value = std::stoull(text, &end);
    if (end != text.size() || value > std::numeric_limits<unsigned>::max())
        throw std::invalid_argument("Seed must be an integer from 0 to 4294967295");
    return static_cast<unsigned>(value);
}

void runFilters(const fs::path& input, const fs::path& directory) {
    const Image source = Filters::toGrayscale(Image(input.string()));
    fs::create_directories(directory);
    auto save = [&](const Image& image, const char* name) {
        saveImage(image, directory / name);
    };
    std::cout << "\nВход: " << input.string()
              << "\nРазмер: " << source.width() << " x " << source.height() << " пикселей\n";
    save(source, "gray.png");
    std::cout << "\n[1] Выделение контуров\n";
    save(Filters::applyLaplacian(source), "laplace.png");
    save(Filters::applyRoberts(source), "roberts.png");
    save(Filters::applySobel(source), "sobel.png");
    std::cout << "    Лаплас, Робертс, Собел — готово.\n";
    std::cout << "\n[2] Усредняющие фильтры\n";
    save(Filters::applyBoxBlur(source, 3), "mean3.png");
    save(Filters::applyBoxBlur(source, 5), "mean5.png");
    save(Filters::applyGaussianBlur(source, 5, 1.0), "gauss5.png");
    std::cout << "    Среднее 3x3, среднее 5x5, Гаусс 5x5 — готово.\n"
              << "\nСохранено 7 PNG в " << directory.string() << "\n";
}

void usage(std::ostream& stream) {
    stream << "Запуск из папки с Lab.sln:\n"
           << "  app                          — готовый пример\n"
           << "  app input.png output_folder  — своё изображение\n"
           << "  app --random [seed]          — дополнительный случайный тест\n"
           << "  app --help                   — справка\n";
}
}

int main(int argc, char** argv) {
#ifdef _WIN32
    SetConsoleOutputCP(CP_UTF8);
#endif
    try {
        std::cout << "Лабораторная работа №2 | Варианты 1 и 2\n";
        const std::string option = argc > 1 ? argv[1] : "";
        if (argc == 2 && option == "--help") {
            usage(std::cout);
            return 0;
        }
        fs::path input, output;
        if (option == "--random" && (argc == 2 || argc == 3)) {
            const unsigned seed = argc == 3 ? readSeed(argv[2]) : 2026;
            input = generateRandomTest(seed);
            output = "test_output/random_" + std::to_string(seed);
        } else if (argc == 1) {
            input = "test_input/shapes_noisy.png";
            output = "test_output/shapes_noisy";
            if (!fs::exists(input)) {
                std::cout << "Готовый пример не найден. Создаётся дополнительный случайный тест.\n";
                input = generateRandomTest(2026);
                output = "test_output/random_2026";
            }
        } else if (argc == 3 && option.rfind("--", 0) != 0) {
            input = argv[1];
            output = argv[2];
        } else {
            usage(std::cerr);
            return 1;
        }
        runFilters(input, output);
    } catch (const std::exception& error) {
        std::cerr << "Ошибка: " << error.what() << '\n';
        return 1;
    }
}
