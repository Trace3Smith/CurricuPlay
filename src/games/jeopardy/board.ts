import { subjects, type Category } from '../../types';
export const categories: Category[] = [...subjects, 'Review'];
export const tiles = categories.flatMap(category => [1, 2, 3, 1, 2, 3].map((difficulty, row) => ({ id: `${category}-${row}`, category, difficulty })));
