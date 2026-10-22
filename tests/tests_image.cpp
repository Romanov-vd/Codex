#define DOCTEST_CONFIG_IMPLEMENT_WITH_MAIN
#include "../include/doctest.h"
#include "../include/Image.h"
#include "../include/stb_image.h"
#include "../include/stb_image_write.h"

#include <filesystem>
#include <vector>
#include <string>
#include <cstring>
#include <iostream>

namespace fs = std::filesystem;

static const std::string OUT_DIR = "test_output";

static void ensure_out_dir() {
	if (!fs::exists(OUT_DIR)) fs::create_directory(OUT_DIR);
}

static std::string make_png(const std::string& name, int w, int h, int channels, const std::vector<uint8_t>& fill) {
	ensure_out_dir();
	std::string path = OUT_DIR + "/" + name;
	size_t size = static_cast<size_t>(w) * h * channels;
	std::vector<uint8_t> buf(size);
	for (size_t i = 0; i < (size_t)w * h; ++i) {
		for (int c = 0; c < channels; ++c) {
			buf[i * channels + c] = (c < (int)fill.size()) ? fill[c] : 0;
		}
	}
	int stride = w * channels;
	int ok = stbi_write_png(path.c_str(), w, h, channels, buf.data(), stride);
	if (!ok) throw std::runtime_error("Failed to write test PNG: " + path);
	return path;
}

TEST_CASE("Core IO: isRead") {
	std::string path = make_png("rgb_test.png", 16, 8, 3, { 10,20,30 });
	Image img;
	CHECK(img.isRead(path));
	CHECK(img.width() == 16);
	CHECK(img.height() == 8);
	CHECK(img.nChannels() == 3);
}

TEST_CASE("Core IO: isWrite") {
	Image img(10, 6, 3);
	img.setColor(3, 2, 77, 88, 99);
	std::string out = OUT_DIR + "/out_isWrite.png";
	CHECK(img.isWrite(out));

	int w, h, n;
	unsigned char* raw = stbi_load(out.c_str(), &w, &h, &n, 0);
	REQUIRE(raw != nullptr);
	CHECK(w == img.width());
	CHECK(h == img.height());
	CHECK(n == img.nChannels());
	stbi_image_free(raw);
}

TEST_CASE("Ctor(width,height,nChannels)") {
	Image img(12, 7, 4);
	CHECK(img.width() == 12);
	CHECK(img.height() == 7);
	CHECK(img.nChannels() == 4);
	CHECK(img.isWrite(OUT_DIR + "/tmp_ctor.png"));
}

TEST_CASE("Ctor(filepath) throws") {
	bool threw = false;
	try { Image img("nonexistent_file.png"); }
	catch (const std::runtime_error&) { threw = true; }
	CHECK(threw);
}

TEST_CASE("get/set for nChannels == 1 (gray)") {
	Image img(5, 5, 1);
	img.setColor(2, 2, 150, 0, 0);
	int r, g, b;
	img.getColor(2, 2, r, g, b);
	CHECK(r == 150);
	CHECK(g != 150);
	CHECK(b != 150);
}

TEST_CASE("get/set for nChannels == 2 (gray+alpha)") {
	Image img(5, 5, 2);
	img.setColor(1, 1, 77, 0, 0);
	int r, g, b;
	img.getColor(1, 1, r, g, b);
	CHECK(r == 77);
	CHECK(g != 77);
	CHECK(b != 77);
}

TEST_CASE("get/set for nChannels == 3 (RGB)") {
	Image img(6, 6, 3);
	img.setColor(0, 0, 12, 34, 56);
	int r, g, b;
	img.getColor(0, 0, r, g, b);
	CHECK(r == 12);
	CHECK(g == 34);
	CHECK(b == 56);
}

TEST_CASE("get/set for nChannels == 4 (RGBA)") {
	Image img(6, 6, 4);
	img.setColor(3, 4, 200, 201, 202);
	int r, g, b;
	img.getColor(3, 4, r, g, b);
	CHECK(r == 200);
	CHECK(g == 201);
	CHECK(b == 202);
}

TEST_CASE("Bounds: set/get out-of-range") {
	Image img(3, 3, 3);
	CHECK_NOTHROW(img.setColor(-1, 0, 1, 2, 3));
	CHECK_NOTHROW(img.setColor(0, -1, 1, 2, 3));
	CHECK_NOTHROW(img.setColor(100, 100, 1, 2, 3));
	int r, g, b;
	CHECK_NOTHROW(img.getColor(-2, 0, r, g, b));
	CHECK_NOTHROW(img.getColor(0, -2, r, g, b));
	CHECK_NOTHROW(img.getColor(100, 0, r, g, b));
}

TEST_CASE("Empty Image") {
	Image img;
	CHECK(img.width() == 0);
	CHECK_FALSE(img.isWrite(OUT_DIR + "/should_not_write.png"));
}

TEST_CASE("Deep copy semantics") {
	Image a(4, 4, 3);
	a.setColor(0, 0, 5, 6, 7);
	Image b = a;
	a.setColor(0, 0, 99, 99, 99);
	int r, g, bb;
	b.getColor(0, 0, r, g, bb);
	CHECK(r == 5);
	CHECK(g == 6);
	CHECK(bb == 7);
}

TEST_CASE("Stride and saved PNG") {
	Image img(8, 8, 3);
	img.setColor(4, 4, 12, 34, 56);
	std::string out = OUT_DIR + "/roundtrip.png";
	CHECK(img.isWrite(out));

	int w, h, n;
	unsigned char* raw = stbi_load(out.c_str(), &w, &h, &n, 0);
	REQUIRE(raw != nullptr);
	size_t idx = (4 * w + 4) * n;
	CHECK(raw[idx + 0] == 12);
	CHECK(raw[idx + 1] == 34);
	CHECK(raw[idx + 2] == 56);
	stbi_image_free(raw);
}
