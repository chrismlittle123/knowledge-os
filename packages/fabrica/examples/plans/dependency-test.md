---
repo: chrismlittle123-testing/fabrica-testing
base_branch: main
---

# Feature: Build a calculator with layered dependencies

## Task 1: Create base math utilities
> Role: builder
> Depends on: none

Create a basic math utilities module with add and subtract functions.

### Acceptance Criteria
- [ ] Create `src/math/basic.js` with `add(a, b)` and `subtract(a, b)` functions
- [ ] Export both functions
- [ ] Include JSDoc comments

## Task 2: Create advanced math using basic math
> Role: builder
> Depends on: Task 1

Create advanced math functions that USE the basic math functions from Task 1.

### Acceptance Criteria
- [ ] Create `src/math/advanced.js`
- [ ] Import `add` and `subtract` from `./basic.js`
- [ ] Create `multiply(a, b)` using repeated addition (use the `add` function)
- [ ] Create `power(base, exp)` using repeated multiplication
- [ ] Export both functions

## Task 3: Create calculator that uses both modules
> Role: builder
> Depends on: Task 1, Task 2

Create a Calculator class that combines all math operations.

### Acceptance Criteria
- [ ] Create `src/calculator.js`
- [ ] Import functions from both `./math/basic.js` and `./math/advanced.js`
- [ ] Create Calculator class with methods: add, subtract, multiply, power
- [ ] Include a `calculate(expression)` method that parses simple expressions like "2 + 3"
- [ ] Export the Calculator class

## Task 4: Write tests for the entire chain
> Role: tester
> Depends on: Task 1, Task 2, Task 3

Write tests that verify the dependency chain works correctly.

### Acceptance Criteria
- [ ] Create `src/calculator.test.js`
- [ ] Test basic.js functions directly
- [ ] Test advanced.js functions (verify they use basic.js internally)
- [ ] Test Calculator class methods
- [ ] Test the calculate() expression parser
- [ ] All tests must pass
