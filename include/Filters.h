#pragma once
#include "Image.h"

namespace Filters {
// Вариант 1: выделение контуров.
Image applyLaplacian(const Image& source);
Image applyRoberts(const Image& source);
Image applySobel(const Image& source);

// Вариант 2: усредняющие фильтры.
Image applyBoxBlur(const Image& source, int kernelSize = 3);
Image applyGaussianBlur(const Image& source, int kernelSize = 3, double sigma = 1.0);

Image toGrayscale(const Image& source);
}
