#include "Filters.h"
#include <algorithm>
#include <cmath>
#include <filesystem>
#include <iostream>
#include <fstream>
#include <iomanip>
#include <vector>
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

void runFilters(const fs::path& input, const fs::path& directory, const fs::path& reference) {
    const Image source = Filters::convertToGrayscale(Image(input.string()));
    Image clean;
    if (!reference.empty()) {
        clean = Filters::convertToGrayscale(Image(reference.string()));
        if (clean.width() != source.width() || clean.height() != source.height())
            throw std::invalid_argument("Reference and input sizes differ");
    }
    fs::create_directories(directory);
    // Без эталона не оставляем метрики от предыдущего запуска.
    if (reference.empty()) fs::remove(directory / "metrics.csv");
    std::cout << "\nВход: " << input.string()
              << "\nРазмер: " << source.width() << " x " << source.height() << " пикселей\n";
    saveImage(source, directory / "grayscale.png");
    std::cout << "\n[1] Контуры: Лаплас, Робертс, Собел\n";
    saveImage(Filters::laplaceEdges(source), directory / "laplace_edges.png");
    saveImage(Filters::robertsEdges(source), directory / "roberts_edges.png");
    saveImage(Filters::sobelEdges(source), directory / "sobel_edges.png");

    // Названия результатов совпадают с названиями методов в отчёте.
    std::vector<std::pair<std::string, Image>> results;
    std::cout << "[2] Усреднение: среднее 3x3, 5x5; Гаусс 5x5, sigma=1\n";
    results.emplace_back("mean_3x3", Filters::meanFilter(source, 3));
    results.emplace_back("mean_5x5", Filters::meanFilter(source, 5));
    results.emplace_back("gaussian_5x5", Filters::gaussianFilter(source, 5, 1.0));
    std::cout << "[3] Порядковые фильтры: медиана, минимум, максимум 3x3 и 5x5\n";
    for (int size : {3, 5}) {
        const std::string suffix = "_" + std::to_string(size) + "x" + std::to_string(size);
        results.emplace_back("median" + suffix, Filters::medianFilter(source, size));
        results.emplace_back("minimum" + suffix, Filters::minimumFilter(source, size));
        results.emplace_back("maximum" + suffix, Filters::maximumFilter(source, size));
    }
    for (const auto& result : results)
        saveImage(result.second, directory / (result.first + ".png"));
    std::cout << "Сохранено 13 PNG в " << directory.string() << "\n";

    if (!reference.empty()) {
        std::ofstream csv(directory / "metrics.csv");
        if (!csv) throw std::runtime_error("Cannot save metrics.csv");
        csv << "method,mse,psnr_db\n" << std::fixed << std::setprecision(5);
        auto measure = [&](const std::string& name, const Image& image) {
            csv << name << ',' << Filters::calculateMSE(clean, image) << ','
                << Filters::calculatePSNR(clean, image) << '\n';
        };
        measure("noisy_input", source);
        for (const auto& result : results) measure(result.first, result.second);
        csv.close();
        if (!csv) throw std::runtime_error("Cannot finish writing metrics.csv");
        std::cout << "MSE и PSNR сохранены в metrics.csv\n";
    }
}

void usage(std::ostream& stream) {
    stream << "Запуск из папки с Lab.sln:\n"
           << "  app                          — готовый пример\n"
           << "  app input.png output_folder [clean.png] — свой вход и необязательный эталон\n"
           << "  app --random [seed]          — дополнительный случайный тест\n"
           << "  app --help                   — справка\n";
}
}

int main(int argc, char** argv) {
#ifdef _WIN32
    SetConsoleOutputCP(CP_UTF8);
#endif
    try {
        std::cout << "Лабораторная работа №2 | Варианты 1, 2 и 3\n";
        const std::string option = argc > 1 ? argv[1] : "";
        if (argc == 2 && option == "--help") {
            usage(std::cout);
            return 0;
        }
        fs::path input, output, reference;
        if (option == "--random" && (argc == 2 || argc == 3)) {
            const unsigned seed = argc == 3 ? readSeed(argv[2]) : 2026;
            input = generateRandomTest(seed);
            output = "test_output/random_" + std::to_string(seed);
            reference = input.parent_path() / "clean.png";
        } else if (argc == 1) {
            input = "test_input/shapes_noisy.png";
            output = "test_output/shapes_noisy";
            if (fs::exists("test_input/shapes.png")) reference = "test_input/shapes.png";
            if (!fs::exists(input)) {
                std::cout << "Готовый пример не найден. Создаётся дополнительный случайный тест.\n";
                input = generateRandomTest(2026);
                output = "test_output/random_2026";
                reference = input.parent_path() / "clean.png";
            }
        } else if ((argc == 3 || argc == 4) && option.rfind("--", 0) != 0) {
            input = argv[1];
            output = argv[2];
            if (argc == 4) reference = argv[3];
        } else {
            usage(std::cerr);
            return 1;
        }
        runFilters(input, output, reference);
    } catch (const std::exception& error) {
        std::cerr << "Ошибка: " << error.what() << '\n';
        return 1;
    }
}
