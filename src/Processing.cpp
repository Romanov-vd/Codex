#include "Processing.h"
#include <algorithm>
#include <cmath>
#include <vector>

namespace {
void requireGray(const Image& image) {
    if (image.width() <= 0 || image.height() <= 0 || image.nChannels() != 1)
        throw std::invalid_argument("Expected a nonempty grayscale image");
}
void requireWindow(int window) {
    if (window < 1 || window > 31 || window % 2 == 0)
        throw std::invalid_argument("Window must be odd and between 1 and 31");
}
int sample(const Image& image, int x, int y) {
    // Replicate the closest border pixel; do not add artificial black edges.
    x = std::clamp(x, 0, image.width() - 1);
    y = std::clamp(y, 0, image.height() - 1);
    int r = 0, g = 0, b = 0;
    image.getColor(x, y, r, g, b);
    return r;
}
void put(Image& image, int x, int y, double value) {
    const int v = static_cast<int>(std::lround(std::clamp(value, 0.0, 255.0)));
    image.setColor(x, y, v, v, v);
}
}

namespace processing {
Image grayscale(const Image& input) {
    if (input.width() <= 0 || input.height() <= 0)
        throw std::invalid_argument("Empty input image");
    Image result(input.width(), input.height(), 1);
    for (int y = 0; y < input.height(); ++y)
        for (int x = 0; x < input.width(); ++x) {
            int r = 0, g = 0, b = 0;
            input.getColor(x, y, r, g, b);
            put(result, x, y, input.nChannels() < 3 ? r : 0.299*r + 0.587*g + 0.114*b);
        }
    return result;
}

Image edges(const Image& gray, Edge method) {
    requireGray(gray);
    Image result(gray.width(), gray.height(), 1);
    const int sx[3][3] = {{-1,0,1}, {-2,0,2}, {-1,0,1}};
    const int sy[3][3] = {{-1,-2,-1}, {0,0,0}, {1,2,1}};
    for (int y = 0; y < gray.height(); ++y)
        for (int x = 0; x < gray.width(); ++x) {
            double value = 0;
            if (method == Edge::Laplace) {
                value = std::abs(sample(gray,x-1,y) + sample(gray,x+1,y) +
                                 sample(gray,x,y-1) + sample(gray,x,y+1) - 4*sample(gray,x,y));
            } else if (method == Edge::Roberts) {
                const int a = sample(gray,x,y) - sample(gray,x+1,y+1);
                const int b = sample(gray,x+1,y) - sample(gray,x,y+1);
                value = std::hypot(a, b);
            } else {
                int gx = 0, gy = 0;
                for (int j = -1; j <= 1; ++j)
                    for (int i = -1; i <= 1; ++i) {
                        const int p = sample(gray,x+i,y+j);
                        gx += p * sx[j+1][i+1];
                        gy += p * sy[j+1][i+1];
                    }
                value = std::hypot(gx, gy);
            }
            put(result, x, y, value);
        }
    return result;
}

Image average(const Image& gray, int window, double sigma) {
    requireGray(gray);
    requireWindow(window);
    if (!std::isfinite(sigma) || sigma < 0)
        throw std::invalid_argument("Sigma must be finite and nonnegative");
    const int radius = window / 2;
    std::vector<double> weights(window * window, 1.0);
    double total = 0;
    for (int j = -radius; j <= radius; ++j)
        for (int i = -radius; i <= radius; ++i) {
            double& w = weights[(j+radius)*window+i+radius];
            if (sigma > 0) w = std::exp(-(i*i+j*j)/(2*sigma*sigma));
            total += w;
        }
    for (double& w : weights) w /= total;
    Image result(gray.width(), gray.height(), 1);
    for (int y = 0; y < gray.height(); ++y)
        for (int x = 0; x < gray.width(); ++x) {
            double sum = 0;
            for (int j = -radius; j <= radius; ++j)
                for (int i = -radius; i <= radius; ++i)
                    sum += weights[(j+radius)*window+i+radius] * sample(gray,x+i,y+j);
            put(result,x,y,sum);
        }
    return result;
}

Image rank(const Image& gray, int window, Rank method) {
    requireGray(gray);
    requireWindow(window);
    Image result(gray.width(), gray.height(), 1);
    const int radius = window / 2;
    std::vector<int> values(window * window);
    for (int y = 0; y < gray.height(); ++y)
        for (int x = 0; x < gray.width(); ++x) {
            int k = 0;
            for (int j = -radius; j <= radius; ++j)
                for (int i = -radius; i <= radius; ++i)
                    values[k++] = sample(gray,x+i,y+j);
            int value;
            if (method == Rank::Minimum)
                value = *std::min_element(values.begin(), values.end());
            else if (method == Rank::Maximum)
                value = *std::max_element(values.begin(), values.end());
            else {
                auto middle = values.begin() + values.size()/2;
                std::nth_element(values.begin(), middle, values.end());
                value = *middle;
            }
            put(result,x,y,value);
        }
    return result;
}
}
