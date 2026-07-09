# Problem
Given a sorted array of n distinct integers, find the index of a target value 
using binary search. Explain why it runs in O(log n) instead of O(n), using the 
example array [2, 5, 8, 12, 16, 23, 38, 45, 56, 72, 91] (indices 0-10), target 45.

# Solution
1. low=0, high=10, mid=5, array[5]=23. 45>23, so low=6.
2. low=6, high=10, mid=8, array[8]=56. 45<56, so high=7.
3. low=6, high=7, mid=6, array[6]=38. 45>38, so low=7.
4. low=7, high=7, mid=7, array[7]=45. Found at index 7.

Each step halves the remaining elements: after k steps, n/2^k elements remain. 
Search ends when n/2^k=1, so k=log2(n) — hence O(log n) vs O(n) for linear scan.

Answer: target 45 found at index 7 in 4 steps (worst case for n=11 is ceil(log2(11))=4).

Learning objectives: divide-and-conquer strategy, why halving the search space 
gives logarithmic time, tracing comparisons step by step.
