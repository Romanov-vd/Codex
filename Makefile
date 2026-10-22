CXX ?= g++
CPPFLAGS = -Iinclude
CXXFLAGS = -std=c++17 -O2 -Wall -Wextra
CORE = src/Image.cpp src/Processing.cpp
HEADERS = $(wildcard include/*.h)

.PHONY: all test demo clean
all: build/lab build/tests

build:
	mkdir -p build

build/lab: $(CORE) src/main.cpp $(HEADERS) | build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) $(CORE) src/main.cpp -o $@

build/tests: $(CORE) tests/tests_image.cpp tests/tests_processing.cpp $(HEADERS) | build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) $(CORE) tests/tests_image.cpp tests/tests_processing.cpp -o $@

test: build/tests
	./build/tests

demo: build/lab
	./build/lab input/shapes.png output/shapes
	./build/lab input/shapes_noisy.png output/shapes_noisy
	./build/lab input/detail.png output/detail
	./build/lab input/detail_noisy.png output/detail_noisy

clean:
	rm -rf build test_output
