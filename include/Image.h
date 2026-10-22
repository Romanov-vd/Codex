#pragma once
#include <string>
#include <memory>
#include <cstdint>
#include <stdexcept>

struct Color {
	uint8_t r{ 0 }, g{ 0 }, b{ 0 }, a{ 255 };
};

class Image {
public:
	Image();
	Image(int width, int height, int nChannels);
	Image(const std::string& filepath);
	Image(const Image& other);
	Image& operator=(const Image& other);

	~Image() = default;

	bool isRead(const std::string& filepath);
	bool isWrite(const std::string& filepath) const;

	void setColor(int x, int y, int r, int g, int b);
	void getColor(int x, int y, int& r, int& g, int& b) const;

	int width() const { return m_width; }
	int height() const { return m_height; }
	int nChannels() const { return m_nChannels; }

private:
	int m_width{ 0 };
	int m_height{ 0 };
	int m_nChannels{ 0 };
	size_t m_size{ 0 };
	std::unique_ptr<uint8_t[]> m_data;
};
