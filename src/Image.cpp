#define STB_IMAGE_IMPLEMENTATION
#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stb_image.h"
#include "stb_image_write.h"
#include "Image.h"
#include <cstring>
#include <limits>

Image::Image() = default;

Image::Image(int width, int height, int nChannels) {
    if (width <= 0 || height <= 0 || nChannels < 1 || nChannels > 4)
        throw std::invalid_argument("Invalid image dimensions or channel count");
    const size_t limit = std::numeric_limits<size_t>::max();
    if (static_cast<size_t>(width) > limit / height / nChannels ||
        width > std::numeric_limits<int>::max() / nChannels)
        throw std::length_error("Image is too large");
    m_width = width;
    m_height = height;
    m_nChannels = nChannels;
    m_size = static_cast<size_t>(width) * height * nChannels;
    m_data = std::make_unique<uint8_t[]>(m_size);
    if (nChannels == 2 || nChannels == 4)
        for (size_t i = nChannels - 1; i < m_size; i += nChannels)
            m_data[i] = 255;
}

Image::Image(const std::string& filepath) {
    if (!isRead(filepath)) throw std::runtime_error("Cannot read: " + filepath);
}

Image::Image(const Image& other)
    : m_width(other.m_width), m_height(other.m_height),
      m_nChannels(other.m_nChannels), m_size(other.m_size) {
    if (m_size) {
        m_data = std::make_unique<uint8_t[]>(m_size);
        std::memcpy(m_data.get(), other.m_data.get(), m_size);
    }
}

Image& Image::operator=(const Image& other) {
    if (this == &other) return *this;
    // Allocate before changing the object: allocation failure preserves its state.
    auto copy = other.m_size ? std::make_unique<uint8_t[]>(other.m_size) : nullptr;
    if (copy) std::memcpy(copy.get(), other.m_data.get(), other.m_size);
    m_data = std::move(copy);
    m_width = other.m_width;
    m_height = other.m_height;
    m_nChannels = other.m_nChannels;
    m_size = other.m_size;
    return *this;
}

bool Image::isRead(const std::string& filepath) {
    int w = 0, h = 0, channels = 0;
    std::unique_ptr<stbi_uc, decltype(&stbi_image_free)> raw(
        stbi_load(filepath.c_str(), &w, &h, &channels, 0), stbi_image_free);
    if (!raw) return false;
    Image loaded(w, h, channels);
    std::memcpy(loaded.m_data.get(), raw.get(), loaded.m_size);
    *this = loaded;
    return true;
}

bool Image::isWrite(const std::string& filepath) const {
    if (!m_data) return false;
    return stbi_write_png(filepath.c_str(), m_width, m_height, m_nChannels,
                          m_data.get(), m_width * m_nChannels) != 0;
}

void Image::setColor(int x, int y, int r, int g, int b) {
    if (!m_data || x < 0 || y < 0 || x >= m_width || y >= m_height) return;
    const size_t i = (static_cast<size_t>(y) * m_width + x) * m_nChannels;
    m_data[i] = static_cast<uint8_t>(r);
    if (m_nChannels >= 3) {
        m_data[i + 1] = static_cast<uint8_t>(g);
        m_data[i + 2] = static_cast<uint8_t>(b);
    }
    // Alpha is not an argument of setColor and is therefore preserved.
}

void Image::getColor(int x, int y, int& r, int& g, int& b) const {
    if (!m_data || x < 0 || y < 0 || x >= m_width || y >= m_height) return;
    const size_t i = (static_cast<size_t>(y) * m_width + x) * m_nChannels;
    r = m_data[i];
    // For gray/gray-alpha the intensity is returned in r (as in supplied tests).
    g = m_nChannels >= 3 ? m_data[i + 1] : 0;
    b = m_nChannels >= 3 ? m_data[i + 2] : 0;
}
