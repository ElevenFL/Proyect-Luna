import { useStories as useStoriesContext } from '@/contexts/StoriesContext';

export const useStories = () => {
  return useStoriesContext();
};

