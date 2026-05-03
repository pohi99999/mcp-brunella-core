import { navigationRegistry } from "@/lib/navigation";

export const SIDEBAR_ITEMS = navigationRegistry.getAllItems().map(item => ({
  id: item.id,
  label: item.label,
  icon: item.icon
}));

// Backward compatibility for components using groups
export const MENU_GROUPS = navigationRegistry.getGroups();
