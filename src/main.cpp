#include "Processing.h"
#include <filesystem>
#include <iostream>

int main(int argc, char** argv) {
    if (argc != 3) {
        std::cerr << "Usage: lab input.png output_directory\n";
        return 1;
    }
    try {
        const Image input = processing::grayscale(Image(argv[1]));
        const std::filesystem::path directory(argv[2]);
        std::filesystem::create_directories(directory);
        auto save = [&](const Image& image, const char* name) {
            const auto path = directory / name;
            if (!image.isWrite(path.string()))
                throw std::runtime_error("Cannot save: " + path.string());
        };
        using namespace processing;
        save(input, "gray.png");
        save(edges(input, Edge::Laplace), "laplace.png");
        save(edges(input, Edge::Roberts), "roberts.png");
        save(edges(input, Edge::Sobel), "sobel.png");
        save(average(input, 3), "mean3.png");
        save(average(input, 5), "mean5.png");
        save(average(input, 5, 1.0), "gauss5.png");
        std::cout << input.width() << 'x' << input.height()
                  << ": saved 7 PNG files to " << directory.string() << '\n';
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
