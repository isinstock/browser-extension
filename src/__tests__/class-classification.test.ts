import {describe, expect, test} from 'vitest'

import {classifyClass, isHashedClass, isUtilityClass} from '../utils/class-classification'

describe('isUtilityClass', () => {
  test('variant prefix with colon → utility', () => {
    expect(isUtilityClass('sm:p-4')).toBe(true)
    expect(isUtilityClass('hover:bg-blue-500')).toBe(true)
    expect(isUtilityClass('dark:text-white')).toBe(true)
    expect(isUtilityClass('md:flex')).toBe(true)
    expect(isUtilityClass('lg:p-8')).toBe(true)
  })

  test('negative utilities → utility', () => {
    expect(isUtilityClass('-m-4')).toBe(true)
    expect(isUtilityClass('-translate-x-1')).toBe(true)
    expect(isUtilityClass('-mt-2')).toBe(true)
  })

  test('single-word utilities → utility', () => {
    expect(isUtilityClass('flex')).toBe(true)
    expect(isUtilityClass('grid')).toBe(true)
    expect(isUtilityClass('hidden')).toBe(true)
    expect(isUtilityClass('relative')).toBe(true)
    expect(isUtilityClass('static')).toBe(true)
    expect(isUtilityClass('block')).toBe(true)
    expect(isUtilityClass('inline')).toBe(true)
    expect(isUtilityClass('truncate')).toBe(true)
  })

  test('prefix-value patterns → utility', () => {
    expect(isUtilityClass('p-4')).toBe(true)
    expect(isUtilityClass('bg-white')).toBe(true)
    expect(isUtilityClass('text-lg')).toBe(true)
    expect(isUtilityClass('rounded-md')).toBe(true)
    expect(isUtilityClass('shadow-lg')).toBe(true)
    expect(isUtilityClass('border-2')).toBe(true)
    expect(isUtilityClass('w-full')).toBe(true)
    expect(isUtilityClass('h-screen')).toBe(true)
    expect(isUtilityClass('gap-4')).toBe(true)
    expect(isUtilityClass('z-10')).toBe(true)
    expect(isUtilityClass('mx-auto')).toBe(true)
    expect(isUtilityClass('mb-2')).toBe(true)
  })

  test('semantic classes → not utility', () => {
    expect(isUtilityClass('product-card')).toBe(false)
    expect(isUtilityClass('sidebar')).toBe(false)
    expect(isUtilityClass('header')).toBe(false)
    expect(isUtilityClass('main-content')).toBe(false)
    expect(isUtilityClass('nav-link')).toBe(false)
    expect(isUtilityClass('card')).toBe(false)
    expect(isUtilityClass('btn-primary')).toBe(false)
  })
})

describe('isHashedClass', () => {
  test('CSS module hashed classes → hashed', () => {
    expect(isHashedClass('styles_card__abc123')).toBe(true)
    expect(isHashedClass('Component_wrapper__Xk9mP')).toBe(true)
    expect(isHashedClass('module_title__a1b2c3')).toBe(true)
    expect(isHashedClass('nav_item__ABCD1234')).toBe(true)
  })

  test('regular classes with underscores → not hashed', () => {
    expect(isHashedClass('my_class')).toBe(false)
    expect(isHashedClass('some_thing')).toBe(false)
    // Short suffix — not enough chars after __
    expect(isHashedClass('foo__ab')).toBe(false)
    expect(isHashedClass('foo__abc')).toBe(false)
  })

  test('semantic classes → not hashed', () => {
    expect(isHashedClass('product-card')).toBe(false)
    expect(isHashedClass('sidebar')).toBe(false)
  })
})

describe('classifyClass', () => {
  test('utility classes classified as utility', () => {
    expect(classifyClass('sm:p-4')).toBe('utility')
    expect(classifyClass('-m-4')).toBe('utility')
    expect(classifyClass('flex')).toBe('utility')
    expect(classifyClass('p-4')).toBe('utility')
    expect(classifyClass('bg-white')).toBe('utility')
  })

  test('hashed classes classified as hashed', () => {
    expect(classifyClass('styles_card__abc123')).toBe('hashed')
    expect(classifyClass('Component_wrapper__Xk9mP')).toBe('hashed')
  })

  test('semantic classes classified as semantic', () => {
    expect(classifyClass('product-card')).toBe('semantic')
    expect(classifyClass('sidebar')).toBe('semantic')
    expect(classifyClass('header')).toBe('semantic')
    expect(classifyClass('my_class')).toBe('semantic')
    expect(classifyClass('card')).toBe('semantic')
    expect(classifyClass('btn-primary')).toBe('semantic')
  })

  test('hashed takes priority over utility pattern', () => {
    // A class that looks like both hashed and utility — hashed wins
    expect(classifyClass('text-something__abcd1234')).toBe('hashed')
  })
})
