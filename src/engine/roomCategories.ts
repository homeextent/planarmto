export interface RoomCategoryConfig {
  id: string;
  name: string;
  color: string; // Hex for borders/badges
  fillColorDark: string; // rgba for dark theme canvas
  fillColorLight: string; // rgba for light theme canvas
  fillColorBlueprint: string; // rgba for blueprint theme
  fillColorPrint: string; // rgba for print/PDF
  badgeBg: string;
  badgeText: string;
}

export const ROOM_CATEGORIES: Record<string, RoomCategoryConfig> = {
  living: {
    id: 'living',
    name: 'Living & Social',
    color: '#f59e0b', // Amber
    fillColorDark: 'rgba(245, 158, 11, 0.15)',
    fillColorLight: 'rgba(245, 158, 11, 0.18)',
    fillColorBlueprint: 'rgba(245, 158, 11, 0.22)',
    fillColorPrint: 'rgba(245, 158, 11, 0.15)',
    badgeBg: 'bg-amber-950/80 border-amber-500/40',
    badgeText: 'text-amber-400',
  },
  bedroom: {
    id: 'bedroom',
    name: 'Bedroom & Sleeping',
    color: '#6366f1', // Indigo
    fillColorDark: 'rgba(99, 102, 241, 0.15)',
    fillColorLight: 'rgba(99, 102, 241, 0.18)',
    fillColorBlueprint: 'rgba(99, 102, 241, 0.22)',
    fillColorPrint: 'rgba(99, 102, 241, 0.15)',
    badgeBg: 'bg-indigo-950/80 border-indigo-500/40',
    badgeText: 'text-indigo-400',
  },
  kitchen: {
    id: 'kitchen',
    name: 'Kitchen & Dining',
    color: '#10b981', // Emerald
    fillColorDark: 'rgba(16, 185, 129, 0.15)',
    fillColorLight: 'rgba(16, 185, 129, 0.18)',
    fillColorBlueprint: 'rgba(16, 185, 129, 0.22)',
    fillColorPrint: 'rgba(16, 185, 129, 0.15)',
    badgeBg: 'bg-emerald-950/80 border-emerald-500/40',
    badgeText: 'text-emerald-400',
  },
  bathroom: {
    id: 'bathroom',
    name: 'Bathroom & Ensuite',
    color: '#06b6d4', // Cyan
    fillColorDark: 'rgba(6, 182, 212, 0.15)',
    fillColorLight: 'rgba(6, 182, 212, 0.18)',
    fillColorBlueprint: 'rgba(6, 182, 212, 0.22)',
    fillColorPrint: 'rgba(6, 182, 212, 0.15)',
    badgeBg: 'bg-cyan-950/80 border-cyan-500/40',
    badgeText: 'text-cyan-400',
  },
  work: {
    id: 'work',
    name: 'Office & Flex',
    color: '#a855f7', // Purple
    fillColorDark: 'rgba(168, 85, 247, 0.15)',
    fillColorLight: 'rgba(168, 85, 247, 0.18)',
    fillColorBlueprint: 'rgba(168, 85, 247, 0.22)',
    fillColorPrint: 'rgba(168, 85, 247, 0.15)',
    badgeBg: 'bg-purple-950/80 border-purple-500/40',
    badgeText: 'text-purple-400',
  },
  utility: {
    id: 'utility',
    name: 'Utility, Entry & Storage',
    color: '#64748b', // Slate
    fillColorDark: 'rgba(100, 116, 139, 0.15)',
    fillColorLight: 'rgba(100, 116, 139, 0.18)',
    fillColorBlueprint: 'rgba(100, 116, 139, 0.22)',
    fillColorPrint: 'rgba(100, 116, 139, 0.15)',
    badgeBg: 'bg-slate-950/80 border-slate-500/40',
    badgeText: 'text-slate-400',
  },
  garage: {
    id: 'garage',
    name: 'Garage & Workshop',
    color: '#f97316', // Orange
    fillColorDark: 'rgba(249, 115, 22, 0.15)',
    fillColorLight: 'rgba(249, 115, 22, 0.18)',
    fillColorBlueprint: 'rgba(249, 115, 22, 0.22)',
    fillColorPrint: 'rgba(249, 115, 22, 0.15)',
    badgeBg: 'bg-orange-950/80 border-orange-500/40',
    badgeText: 'text-orange-400',
  },
  outdoor: {
    id: 'outdoor',
    name: 'Outdoor, Deck & Porch',
    color: '#ec4899', // Pink / Rose
    fillColorDark: 'rgba(236, 72, 153, 0.15)',
    fillColorLight: 'rgba(236, 72, 153, 0.18)',
    fillColorBlueprint: 'rgba(236, 72, 153, 0.22)',
    fillColorPrint: 'rgba(236, 72, 153, 0.15)',
    badgeBg: 'bg-pink-950/80 border-pink-500/40',
    badgeText: 'text-pink-400',
  },
};

export function getRoomCategory(roomName: string): RoomCategoryConfig {
  const lower = (roomName || '').toLowerCase();

  if (
    lower.includes('bed') ||
    lower.includes('sleep') ||
    lower.includes('nursery') ||
    lower.includes('guest')
  ) {
    return ROOM_CATEGORIES.bedroom;
  }
  if (
    lower.includes('bath') ||
    lower.includes('ensuite') ||
    lower.includes('powder') ||
    lower.includes('wc') ||
    lower.includes('toilet') ||
    lower.includes('washroom')
  ) {
    return ROOM_CATEGORIES.bathroom;
  }
  if (
    lower.includes('kitchen') ||
    lower.includes('pantry') ||
    lower.includes('dining') ||
    lower.includes('breakfast') ||
    lower.includes('nook') ||
    lower.includes('bar')
  ) {
    return ROOM_CATEGORIES.kitchen;
  }
  if (
    lower.includes('living') ||
    lower.includes('great room') ||
    lower.includes('family') ||
    lower.includes('lounge') ||
    lower.includes('media') ||
    lower.includes('theatre') ||
    lower.includes('salon')
  ) {
    return ROOM_CATEGORIES.living;
  }
  if (
    lower.includes('office') ||
    lower.includes('study') ||
    lower.includes('den') ||
    lower.includes('library') ||
    lower.includes('gym') ||
    lower.includes('fitness') ||
    lower.includes('studio')
  ) {
    return ROOM_CATEGORIES.work;
  }
  if (
    lower.includes('garage') ||
    lower.includes('workshop') ||
    lower.includes('shop') ||
    lower.includes('carport')
  ) {
    return ROOM_CATEGORIES.garage;
  }
  if (
    lower.includes('deck') ||
    lower.includes('patio') ||
    lower.includes('porch') ||
    lower.includes('balcony') ||
    lower.includes('terrace') ||
    lower.includes('lanai') ||
    lower.includes('veranda')
  ) {
    return ROOM_CATEGORIES.outdoor;
  }
  if (
    lower.includes('laundry') ||
    lower.includes('mech') ||
    lower.includes('utility') ||
    lower.includes('storage') ||
    lower.includes('closet') ||
    lower.includes('wic') ||
    lower.includes('mudroom') ||
    lower.includes('entry') ||
    lower.includes('foyer') ||
    lower.includes('hall') ||
    lower.includes('corridor')
  ) {
    return ROOM_CATEGORIES.utility;
  }

  return ROOM_CATEGORIES.living;
}
