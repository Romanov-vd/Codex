#pragma once
#include "Image.h"

// Processing uses grayscale input. Image's original interface is unchanged.
namespace processing {
enum class Edge { Laplace, Roberts, Sobel };
Image grayscale(const Image& input);
Image edges(const Image& gray, Edge method);
Image average(const Image& gray, int window, double sigma = 0.0);
}
