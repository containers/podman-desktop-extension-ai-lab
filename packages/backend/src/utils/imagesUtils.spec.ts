import { expect, test } from 'vitest';
import type { Recipe } from '@shared/models/IRecipe';
import type { ContainerConfig } from '../models/AIConfig';
import { getImageTag } from './imagesUtils';

test('return recipe-container tag if container image prop is not defined', () => {
  const recipe = {
    id: 'recipe1',
  } as Recipe;
  const container = {
    name: 'name',
  } as ContainerConfig;
  const imageTag = getImageTag(recipe, container);
  expect(imageTag).equals('recipe1-name:latest');
});
test('return container image prop is defined', () => {
  const recipe = {
    id: 'recipe1',
  } as Recipe;
  const container = {
    name: 'name',
    image: 'quay.io/repo/image:v1',
  } as ContainerConfig;
  const imageTag = getImageTag(recipe, container);
  expect(imageTag).equals('quay.io/repo/image:v1');
});
test('append latest tag to container image prop if it has no tag', () => {
  const recipe = {
    id: 'recipe1',
  } as Recipe;
  const container = {
    name: 'name',
    image: 'quay.io/repo/image',
  } as ContainerConfig;
  const imageTag = getImageTag(recipe, container);
  expect(imageTag).equals('quay.io/repo/image:latest');
});
