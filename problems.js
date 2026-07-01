// A curated pool of free (non-premium) problems. We pick one at random and
// then fetch its full detail (description + python3 stub + internal id) from
// LeetCode's GraphQL API. Keeping a fixed list avoids randomly drawing a
// premium-locked problem you can't submit to.
export const PROBLEM_SLUGS = [
  // Easy
  "two-sum",
  "valid-parentheses",
  "merge-two-sorted-lists",
  "best-time-to-buy-and-sell-stock",
  "valid-palindrome",
  "invert-binary-tree",
  "valid-anagram",
  "binary-search",
  "majority-element",
  "contains-duplicate",
  "maximum-subarray",
  "climbing-stairs",
  "single-number",
  "fizz-buzz",
  "move-zeroes",
  // Medium
  "add-two-numbers",
  "longest-substring-without-repeating-characters",
  "group-anagrams",
  "product-of-array-except-self",
  "3sum",
  "container-with-most-water",
  "search-in-rotated-sorted-array",
  "coin-change",
  "number-of-islands",
  "course-schedule"
];

export function randomSlug() {
  return PROBLEM_SLUGS[Math.floor(Math.random() * PROBLEM_SLUGS.length)];
}
