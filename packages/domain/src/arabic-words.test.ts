import { describe, expect, it } from 'vitest';
import { amountInWordsEGP, numberToArabicWords } from './arabic-words';
import { DomainError } from './errors';

describe('numberToArabicWords', () => {
  it.each([
    [0, 'صفر'],
    [1, 'واحد'],
    [11, 'أحد عشر'],
    [12, 'اثنا عشر'],
    [21, 'واحد وعشرون'],
    [100, 'مائة'],
    [115, 'مائة وخمسة عشر'],
    [200, 'مائتان'],
    [999, 'تسعمائة وتسعة وتسعون'],
  ])('below thousand: %i', (n, words) => expect(numberToArabicWords(n)).toBe(words));

  it.each([
    [1000, 'ألف'],
    [2000, 'ألفان'],
    [3000, 'ثلاثة آلاف'],
    [10_000, 'عشرة آلاف'],
    [11_000, 'أحد عشر ألفاً'],
    [99_000, 'تسعة وتسعون ألفاً'],
    [100_000, 'مائة ألف'],
    [101_000, 'مائة ألف وألف'],
    [102_000, 'مائة ألف وألفان'],
    [103_000, 'مائة وثلاثة آلاف'],
    [120_000, 'مائة وعشرون ألفاً'],
    [1001, 'ألف وواحد'],
    [2500, 'ألفان وخمسمائة'],
  ])('thousands: %i', (n, words) => expect(numberToArabicWords(n)).toBe(words));

  it.each([
    [1_000_000, 'مليون'],
    [2_000_000, 'مليونان'],
    [5_000_000, 'خمسة ملايين'],
    [15_000_000, 'خمسة عشر مليوناً'],
    [2_450_000, 'مليونان وأربعمائة وخمسون ألفاً'],
    [9_791_650, 'تسعة ملايين وسبعمائة وواحد وتسعون ألفاً وستمائة وخمسون'],
    [105_646_780, 'مائة وخمسة ملايين وستمائة وستة وأربعون ألفاً وسبعمائة وثمانون'],
    [1_000_000_000, 'مليار'],
    [3_000_000_000, 'ثلاثة مليارات'],
  ])('millions/billions: %i', (n, words) => expect(numberToArabicWords(n)).toBe(words));

  it('floors fractions and marks negatives', () => {
    expect(numberToArabicWords(115.99)).toBe('مائة وخمسة عشر');
    expect(numberToArabicWords(-5)).toBe('سالب خمسة');
  });

  it('rejects non-finite and out-of-range values', () => {
    expect(() => numberToArabicWords(Number.NaN)).toThrow(DomainError);
    expect(() => numberToArabicWords(1e12)).toThrow(DomainError);
  });
});

describe('amountInWordsEGP', () => {
  it('writes pounds only when there are no piastres', () => {
    expect(amountInWordsEGP(9_791_650)).toBe('تسعة ملايين وسبعمائة وواحد وتسعون ألفاً وستمائة وخمسون جنيهاً مصرياً لا غير');
    expect(amountInWordsEGP(115)).toBe('مائة وخمسة عشر جنيهاً مصرياً لا غير');
  });
  it('adds piastres', () => {
    expect(amountInWordsEGP(2_450_000.5)).toBe('مليونان وأربعمائة وخمسون ألفاً جنيهاً مصرياً وخمسون قرشاً لا غير');
    expect(amountInWordsEGP(1000.25)).toBe('ألف جنيهاً مصرياً وخمسة وعشرون قرشاً لا غير');
  });
  it('rounds to the nearest piastre', () => {
    expect(amountInWordsEGP(10.999)).toBe('أحد عشر جنيهاً مصرياً لا غير');
  });
  it('handles zero and piastres-only amounts', () => {
    expect(amountInWordsEGP(0)).toBe('صفر جنيهاً مصرياً لا غير');
    expect(amountInWordsEGP(0.75)).toBe('خمسة وسبعون قرشاً لا غير');
  });
  it('marks negative amounts', () => {
    expect(amountInWordsEGP(-2000)).toBe('سالب ألفان جنيهاً مصرياً لا غير');
  });
});
