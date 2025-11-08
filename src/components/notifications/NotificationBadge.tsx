import { Link } from "react-router-dom";
import { Bell } from "lucide-react";

// Hookless, safe NotificationBadge to avoid React hook binding issues
export const NotificationBadge = () => {
  return (
    <Link
      to="/notifications"
      className="relative p-2 hover:bg-accent rounded-full transition-colors"
      aria-label="Notifications"
    >
      <Bell className="w-6 h-6" />
    </Link>
  );
};