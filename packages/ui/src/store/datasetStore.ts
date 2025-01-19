import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface Dataset {
  id: string;
  name: string;
  description: string;
  size: number;
  recordCount: number;
  createdAt: string;
  updatedAt: string;
  status: 'processing' | 'ready' | 'error';
  type: 'tabular' | 'image' | 'text';
  privacyScore: number;
}

interface DatasetFilters {
  type?: Dataset['type'];
  status?: Dataset['status'];
  search?: string;
}

interface DatasetState {
  selectedDataset: Dataset | null;
  filters: DatasetFilters;
  setSelectedDataset: (dataset: Dataset | null) => void;
  setFilters: (filters: Partial<DatasetFilters>) => void;
  resetFilters: () => void;
}

const initialFilters: DatasetFilters = {
  type: undefined,
  status: undefined,
  search: undefined,
};

export const useDatasetStore = create<DatasetState>()(
  devtools(
    (set) => ({
      selectedDataset: null,
      filters: initialFilters,
      setSelectedDataset: (dataset) =>
        set({ selectedDataset: dataset }, false, 'setSelectedDataset'),
      setFilters: (filters) =>
        set(
          (state) => ({
            filters: { ...state.filters, ...filters },
          }),
          false,
          'setFilters'
        ),
      resetFilters: () =>
        set({ filters: initialFilters }, false, 'resetFilters'),
    }),
    {
      name: 'Dataset Store',
    }
  )
); 