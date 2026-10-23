#include "Filters.h"
#include <filesystem>
#include <iostream>

int main(int argc, char** argv) {
    if (argc != 1 && argc != 3) {
        std::cerr << "Usage: app [input.png output_directory]\n";
        return 1;
    }
    try {
        const std::string inputPath = argc == 3 ? argv[1] : "test_input/shapes_noisy.png";
        const std::filesystem::path directory =
            argc == 3 ? argv[2] : "test_output/shapes_noisy";
        const Image source = Filters::toGrayscale(Image(inputPath));
        std::filesystem::create_directories(directory);
        auto save = [&](const Image& image, const char* name) {
            const auto path = directory / name;
            if (!image.isWrite(path.string()))
                throw std::runtime_error("Cannot save: " + path.string());
        };
        save(source, "gray.png");
        std::cout << "[1] Edge detection: Laplacian, Roberts, Sobel\n";
        save(Filters::applyLaplacian(source), "laplace.png");
        save(Filters::applyRoberts(source), "roberts.png");
        save(Filters::applySobel(source), "sobel.png");
        std::cout << "[2] Smoothing: box 3x3, box 5x5, Gaussian 5x5\n";
        save(Filters::applyBoxBlur(source, 3), "mean3.png");
        save(Filters::applyBoxBlur(source, 5), "mean5.png");
        save(Filters::applyGaussianBlur(source, 5, 1.0), "gauss5.png");
        std::cout << source.width() << 'x' << source.height()
                  << ": saved 7 PNG files to " << directory.string() << '\n';
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
