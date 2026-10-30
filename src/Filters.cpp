#include "Filters.h"
#include <algorithm>
#include <cmath>
#include <vector>
#include <limits>

namespace {
enum class Edge { Laplace, Roberts, Sobel };
enum class Rank { Median, Minimum, Maximum };
void checkGrayscale(const Image& image) {
    if (image.width() <= 0 || image.height() <= 0 || image.nChannels() != 1)
        throw std::invalid_argument("Expected a nonempty grayscale image");
}
void checkWindow(int window) {
    if (window < 1 || window > 31 || window % 2 == 0)
        throw std::invalid_argument("Window must be odd and between 1 and 31");
}
int readBorderPixel(const Image& image, int x, int y) {
    // Replicate the closest border pixel; do not add artificial black calculateEdges.
    x = std::clamp(x, 0, image.width() - 1);
    y = std::clamp(y, 0, image.height() - 1);
    int r = 0, g = 0, b = 0;
    image.getColor(x, y, r, g, b);
    return r;
}
void writePixel(Image& image, int x, int y, double value) {
    const int v = static_cast<int>(std::lround(std::clamp(value, 0.0, 255.0)));
    image.setColor(x, y, v, v, v);
}
}

namespace Filters {
Image convertToGrayscale(const Image& input) {
    if (input.width() <= 0 || input.height() <= 0)
        throw std::invalid_argument("Empty input image");
    Image result(input.width(), input.height(), 1);
    for (int y = 0; y < input.height(); ++y)
        for (int x = 0; x < input.width(); ++x) {
            int r = 0, g = 0, b = 0;
            input.getColor(x, y, r, g, b);
            writePixel(result, x, y, input.nChannels() < 3 ? r : 0.299*r + 0.587*g + 0.114*b);
        }
    return result;
}

static Image calculateEdges(const Image& gray, Edge method) {
    checkGrayscale(gray);
    Image result(gray.width(), gray.height(), 1);
    const int sx[3][3] = {{-1,0,1}, {-2,0,2}, {-1,0,1}};
    const int sy[3][3] = {{-1,-2,-1}, {0,0,0}, {1,2,1}};
    for (int y = 0; y < gray.height(); ++y)
        for (int x = 0; x < gray.width(); ++x) {
            double value = 0;
            if (method == Edge::Laplace) {
                value = std::abs(readBorderPixel(gray,x-1,y) + readBorderPixel(gray,x+1,y) +
                                 readBorderPixel(gray,x,y-1) + readBorderPixel(gray,x,y+1) - 4*readBorderPixel(gray,x,y));
            } else if (method == Edge::Roberts) {
                const int a = readBorderPixel(gray,x,y) - readBorderPixel(gray,x+1,y+1);
                const int b = readBorderPixel(gray,x+1,y) - readBorderPixel(gray,x,y+1);
                value = std::hypot(a, b);
            } else {
                int gx = 0, gy = 0;
                for (int j = -1; j <= 1; ++j)
                    for (int i = -1; i <= 1; ++i) {
                        const int p = readBorderPixel(gray,x+i,y+j);
                        gx += p * sx[j+1][i+1];
                        gy += p * sy[j+1][i+1];
                    }
                value = std::hypot(gx, gy);
            }
            writePixel(result, x, y, value);
        }
    return result;
}

static Image weightedAverage(const Image& gray, int window, double sigma) {
    checkGrayscale(gray);
    checkWindow(window);
    if (!std::isfinite(sigma) || sigma < 0)
        throw std::invalid_argument("Sigma must be finite and nonnegative");
    const int radius = window / 2;
    std::vector<double> weights(window * window, 1.0);
    double total = 0;
    for (int j = -radius; j <= radius; ++j)
        for (int i = -radius; i <= radius; ++i) {
            double& w = weights[(j+radius)*window+i+radius];
            if (sigma > 0) {
                const double dx = i / sigma, dy = j / sigma;
                w = std::exp(-0.5 * (dx*dx + dy*dy));
            }
            total += w;
        }
    for (double& w : weights) w /= total;
    Image result(gray.width(), gray.height(), 1);
    for (int y = 0; y < gray.height(); ++y)
        for (int x = 0; x < gray.width(); ++x) {
            double sum = 0;
            for (int j = -radius; j <= radius; ++j)
                for (int i = -radius; i <= radius; ++i)
                    sum += weights[(j+radius)*window+i+radius] * readBorderPixel(gray,x+i,y+j);
            writePixel(result,x,y,sum);
        }
    return result;
}


static Image selectFromWindow(const Image& gray, int window, Rank method) {
    checkGrayscale(gray);
    checkWindow(window);
    Image result(gray.width(), gray.height(), 1);
    const int radius = window / 2;
    std::vector<int> values(window * window);
    for (int y = 0; y < gray.height(); ++y)
        for (int x = 0; x < gray.width(); ++x) {
            int index = 0;
            for (int j = -radius; j <= radius; ++j)
                for (int i = -radius; i <= radius; ++i)
                    values[index++] = readBorderPixel(gray, x+i, y+j);
            int value = 0;
            if (method == Rank::Minimum)
                value = *std::min_element(values.begin(), values.end());
            else if (method == Rank::Maximum)
                value = *std::max_element(values.begin(), values.end());
            else {
                auto middle = values.begin() + values.size()/2;
                std::nth_element(values.begin(), middle, values.end());
                value = *middle;
            }
            writePixel(result, x, y, value);
        }
    return result;
}


Image laplaceEdges(const Image& source) {
    return calculateEdges(convertToGrayscale(source), Edge::Laplace);
}

Image robertsEdges(const Image& source) {
    return calculateEdges(convertToGrayscale(source), Edge::Roberts);
}

Image sobelEdges(const Image& source) {
    return calculateEdges(convertToGrayscale(source), Edge::Sobel);
}

Image meanFilter(const Image& source, int windowSize) {
    return weightedAverage(convertToGrayscale(source), windowSize, 0.0);
}

Image gaussianFilter(const Image& source, int windowSize, double sigma) {
    if (!std::isfinite(sigma) || sigma <= 0)
        throw std::invalid_argument("Gaussian sigma must be finite and positive");
    return weightedAverage(convertToGrayscale(source), windowSize, sigma);
}


Image medianFilter(const Image& source, int windowSize) {
    return selectFromWindow(convertToGrayscale(source), windowSize, Rank::Median);
}

Image minimumFilter(const Image& source, int windowSize) {
    return selectFromWindow(convertToGrayscale(source), windowSize, Rank::Minimum);
}

Image maximumFilter(const Image& source, int windowSize) {
    return selectFromWindow(convertToGrayscale(source), windowSize, Rank::Maximum);
}

double calculateMSE(const Image& reference, const Image& result) {
    if (reference.width() != result.width() || reference.height() != result.height())
        throw std::invalid_argument("Reference and result sizes differ");
    const Image clean = convertToGrayscale(reference);
    const Image filtered = convertToGrayscale(result);
    double sum = 0;
    for (int y = 0; y < clean.height(); ++y)
        for (int x = 0; x < clean.width(); ++x) {
            const double difference = readBorderPixel(clean,x,y) - readBorderPixel(filtered,x,y);
            sum += difference * difference;
        }
    return sum / (static_cast<double>(clean.width()) * clean.height());
}

double calculatePSNR(const Image& reference, const Image& result) {
    const double mse = calculateMSE(reference, result);
    return mse == 0 ? std::numeric_limits<double>::infinity()
                    : 10 * std::log10(255.0 * 255.0 / mse);
}
}
