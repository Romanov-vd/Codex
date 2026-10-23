CXX ?= g++
CPPFLAGS = -Iinclude
CXXFLAGS = -std=c++17 -O2 -Wall -Wextra
SRC_DIR = src
TEST_DIR = tests
BUILD_DIR = build
BIN_DIR = bin
CORE_OBJS = $(BUILD_DIR)/Image.o $(BUILD_DIR)/Filters.o
APP_OBJS = $(CORE_OBJS) $(BUILD_DIR)/Source.o
TEST_OBJS = $(CORE_OBJS) $(BUILD_DIR)/tests_image.o $(BUILD_DIR)/tests_filters.o

.PHONY: all app test run run-test demo clean
all: $(BIN_DIR)/app $(BIN_DIR)/run_tests
app: $(BIN_DIR)/app

$(BUILD_DIR) $(BIN_DIR):
	mkdir -p $@

$(BUILD_DIR)/%.o: $(SRC_DIR)/%.cpp | $(BUILD_DIR)
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -MMD -MP -c $< -o $@

$(BUILD_DIR)/%.o: $(TEST_DIR)/%.cpp | $(BUILD_DIR)
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -MMD -MP -c $< -o $@

$(BIN_DIR)/app: $(APP_OBJS) | $(BIN_DIR)
	$(CXX) $(CXXFLAGS) $^ -o $@

$(BIN_DIR)/run_tests: $(TEST_OBJS) | $(BIN_DIR)
	$(CXX) $(CXXFLAGS) $^ -o $@

run: $(BIN_DIR)/app
	./$(BIN_DIR)/app

test: run-test
run-test: $(BIN_DIR)/run_tests
	./$(BIN_DIR)/run_tests

demo: $(BIN_DIR)/app
	./$(BIN_DIR)/app test_input/shapes.png test_output/shapes
	./$(BIN_DIR)/app test_input/shapes_noisy.png test_output/shapes_noisy
	./$(BIN_DIR)/app test_input/detail.png test_output/detail
	./$(BIN_DIR)/app test_input/detail_noisy.png test_output/detail_noisy

clean:
	rm -rf $(BUILD_DIR) $(BIN_DIR)

-include $(wildcard $(BUILD_DIR)/*.d)
