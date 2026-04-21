import { navigationRegistry, type NavGroup, type NavItem } from "@/lib/navigation";

export const QUICK_ACCESS_ITEM_IDS = [
  "dashboard",
  "learning-loop",
  "tasks",
  "tracks",
  "cloudflare",
] as const;

export const QUICK_ACCESS_SECTION_ID = "quick-access";
export const QUICK_ACCESS_SECTION_TITLE = "Quick access";

export interface NavigationItemContext {
  item: NavItem;
  groupId?: string;
  groupTitle?: string;
  isQuickAccess: boolean;
  quickAccessOrder?: number;
  contextLabel: string;
  searchTerms: string[];
}

export interface NavigationGroupSection {
  id: string;
  title: string;
  icon: NavGroup["icon"];
  items: NavItem[];
  itemCount: number;
}

export interface NavigationQuickAccessSection {
  id: string;
  title: string;
  items: NavItem[];
  itemCount: number;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/gi, "-");
}

function resolveItem(itemId: string): NavItem | undefined {
  return navigationRegistry.getItem(itemId);
}

export function getNavigationItem(itemId: string): NavItem | undefined {
  return resolveItem(itemId);
}

function buildNavigationModel() {
  const allItems = navigationRegistry.getAllItems();
  const quickAccessItems = QUICK_ACCESS_ITEM_IDS.map((itemId) => resolveItem(itemId)).filter(
    (item): item is NavItem => Boolean(item),
  );
  const quickAccessIds = new Set(quickAccessItems.map((item) => item.id));
  const groups = navigationRegistry.getGroups();

  const itemGroups = new Map<
    string,
    {
      id: string;
      title: string;
      icon: NavGroup["icon"];
    }
  >();

  groups.forEach((group) => {
    const groupId = slugify(group.title);
    group.items.forEach((itemId) => {
      if (!itemGroups.has(itemId)) {
        itemGroups.set(itemId, {
          id: groupId,
          title: group.title,
          icon: group.icon,
        });
      }
    });
  });

  const groupSections = groups
    .map((group) => {
      const items = group.items
        .map((itemId) => resolveItem(itemId))
        .filter((item): item is NavItem => Boolean(item) && !quickAccessIds.has(item.id));

      return {
        id: slugify(group.title),
        title: group.title,
        icon: group.icon,
        items,
        itemCount: items.length,
      };
    })
    .filter((section) => section.items.length > 0);

  const itemContexts = new Map<string, NavigationItemContext>();

  allItems.forEach((item) => {
    const quickAccessOrder = QUICK_ACCESS_ITEM_IDS.indexOf(item.id as (typeof QUICK_ACCESS_ITEM_IDS)[number]);
    const group = itemGroups.get(item.id);
    const isQuickAccess = quickAccessOrder >= 0;
    const contextLabel = isQuickAccess
      ? group?.title
        ? `${QUICK_ACCESS_SECTION_TITLE} · ${group.title}`
        : QUICK_ACCESS_SECTION_TITLE
      : group?.title ?? "Navigation";

    const searchTerms = [
      item.label,
      item.id,
      group?.title,
      isQuickAccess ? QUICK_ACCESS_SECTION_TITLE : undefined,
      isQuickAccess && group?.title ? `${QUICK_ACCESS_SECTION_TITLE} ${group.title}` : undefined,
      isQuickAccess ? "favorites" : undefined,
    ].filter((term): term is string => Boolean(term));

    itemContexts.set(item.id, {
      item,
      groupId: group?.id,
      groupTitle: group?.title,
      isQuickAccess,
      quickAccessOrder: isQuickAccess ? quickAccessOrder : undefined,
      contextLabel,
      searchTerms,
    });
  });

  return {
    allItems,
    quickAccessItems,
    quickAccessSection: {
      id: QUICK_ACCESS_SECTION_ID,
      title: QUICK_ACCESS_SECTION_TITLE,
      items: quickAccessItems,
      itemCount: quickAccessItems.length,
    } satisfies NavigationQuickAccessSection,
    groupSections,
    itemContexts,
  };
}

export function getNavigationModel(): {
  allItems: NavItem[];
  quickAccessItems: NavItem[];
  quickAccessSection: NavigationQuickAccessSection;
  groupSections: NavigationGroupSection[];
  itemContexts: Map<string, NavigationItemContext>;
} {
  return buildNavigationModel();
}

export function getNavigationItemContext(itemId: string): NavigationItemContext | undefined {
  return buildNavigationModel().itemContexts.get(itemId);
}
