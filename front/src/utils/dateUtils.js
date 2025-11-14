/**
 * Utility functions for grouping and formatting photos by date
 */

/**
 * Format date as "Сегодня", "Вчера" or "DD.MM.YYYY"
 */
export function formatPhotoDate(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Reset time to midnight for comparison
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

  if (dateOnly.getTime() === todayOnly.getTime()) {
    return 'Сегодня';
  } else if (dateOnly.getTime() === yesterdayOnly.getTime()) {
    return 'Вчера';
  } else {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }
}

/**
 * Get date key for grouping (YYYY-MM-DD format)
 */
export function getDateKey(dateString) {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Group photos by date (newest first)
 * Returns array of { date, dateLabel, photos }
 */
export function groupPhotosByDate(photos) {
  if (!photos || photos.length === 0) return [];

  // Sort photos by date (newest first)
  const sortedPhotos = [...photos].sort((a, b) => {
    return new Date(b.created_at) - new Date(a.created_at);
  });

  // Group by date
  const groups = {};
  sortedPhotos.forEach(photo => {
    const dateKey = getDateKey(photo.created_at);
    if (!groups[dateKey]) {
      groups[dateKey] = {
        dateKey,
        dateLabel: formatPhotoDate(photo.created_at),
        photos: []
      };
    }
    groups[dateKey].photos.push(photo);
  });

  // Convert to sorted array (newest first)
  return Object.values(groups).sort((a, b) => {
    return b.dateKey.localeCompare(a.dateKey);
  });
}
