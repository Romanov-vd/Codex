#pragma once
#include "Image.h"

namespace Filters {
// Вариант 1: выделение контуров.
Image laplaceEdges(const Image& source);
Image robertsEdges(const Image& source);
Image sobelEdges(const Image& source);

// Вариант 2: усредняющие фильтры.
Image meanFilter(const Image& source, int windowSize = 3);
Image gaussianFilter(const Image& source, int windowSize = 3, double sigma = 1.0);

// Вариант 3: выбор среднего, наименьшего или наибольшего элемента окна.
Image medianFilter(const Image& source, int windowSize = 3);
Image minimumFilter(const Image& source, int windowSize = 3);
Image maximumFilter(const Image& source, int windowSize = 3);

// Сравнение результата с чистым эталоном.
double calculateMSE(const Image& reference, const Image& result);
double calculatePSNR(const Image& reference, const Image& result);

Image convertToGrayscale(const Image& source);
}
