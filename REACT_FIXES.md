# React Instance Fixes

This document explains the fixes applied to resolve multiple React instance errors in the FeedIn application.

## Problem

The application was experiencing "Cannot read properties of null (reading 'useState'/'useContext'/'useRef')" errors due to multiple React instances being loaded. This commonly occurs when:
- Dependencies include their own React instance
- Vite's optimization splits React into multiple chunks
- Providers from libraries (like Radix UI) call hooks using a different React instance

## Solutions Applied

### 1. Toast System - Unified to Sonner

**Issue**: Having both shadcn Toast (which uses `useToast` hook) and Sonner toast system caused duplicate React hook calls.

**Solution**: 
- Removed `src/hooks/use-toast.ts`
- Removed `src/components/ui/toaster.tsx`
- Removed `src/components/ui/use-toast.ts`
- All components now use: `import { toast } from 'sonner'`

**Migration Pattern**:
```typescript
// OLD (shadcn toast)
import { useToast } from '@/hooks/use-toast';

const MyComponent = () => {
  const { toast } = useToast();
  
  const handleClick = () => {
    toast({
      title: "Success",
      description: "Operation completed"
    });
  };
};

// NEW (Sonner)
import { toast } from 'sonner';

const MyComponent = () => {
  const handleClick = () => {
    toast.success("Success", {
      description: "Operation completed"
    });
  };
};
```

**Sonner API**:
```typescript
// Success toast
toast.success("Title", { description: "Description" });

// Error toast
toast.error("Error", { description: "Error details" });

// Info toast
toast.info("Info", { description: "Information" });

// Warning toast
toast.warning("Warning", { description: "Warning message" });

// Loading toast
const toastId = toast.loading("Loading...");
// Later update it
toast.success("Done!", { id: toastId });

// Custom toast
toast("Custom message", {
  description: "Description",
  action: {
    label: "Undo",
    onClick: () => console.log("Undo")
  }
});
```

### 2. Tooltip System - No-op Provider

**Issue**: `@radix-ui/react-tooltip`'s `TooltipProvider` was calling `useRef` from a different React instance.

**Solution**: 
- Created a no-op `TooltipProvider` wrapper in `src/components/ui/tooltip.tsx`
- The wrapper accepts all Radix Provider props but simply returns `children`
- This prevents Radix from calling hooks while maintaining component compatibility

**Implementation**:
```typescript
// src/components/ui/tooltip.tsx
const TooltipProvider: React.FC<React.ComponentProps<typeof TooltipPrimitive.Provider>> = ({ children }) => (
  <>{children}</>
);
```

**Why this works**:
- Tooltips still function because they use React Portal internally
- The Provider was primarily for managing delay and skip delay states
- For our use case, individual tooltips work fine without the provider state management
- All existing tooltip usage remains unchanged

### 3. Vite Configuration

**Current Configuration**:
```typescript
// vite.config.ts
optimizeDeps: {
  exclude: ["lucide-react"],
  include: [
    "react",
    "react-dom",
    "react/jsx-runtime",
    "@tanstack/react-query",
    "react-router-dom",
    "next-themes",
    "@radix-ui/react-tooltip",
    "@radix-ui/react-popover",
    "@radix-ui/react-dropdown-menu",
    "@radix-ui/react-dialog"
  ],
},
```

This ensures React and key dependencies are pre-bundled together, reducing the chance of duplicate instances.

## Files Requiring Migration

The following files still use the old toast system and need to be updated to use Sonner:

### Components (High Priority)
- `src/components/auth/ForgotPasswordForm.tsx`
- `src/components/auth/SignInForm.tsx`
- `src/components/auth/SignUpForm.tsx`
- `src/components/feed/PostCard.tsx`
- `src/components/feed/CommentsModal.tsx`
- `src/components/feed/CreatePostModal.tsx`

### Components (Medium Priority)
- All files in `src/components/feed/`
- All files in `src/components/messages/`
- All files in `src/components/groups/`
- All files in `src/components/notifications/`
- All files in `src/components/profile/`
- All files in `src/components/stories/`

### Pages
- Check all page files for toast usage

## Testing Checklist

After migration, verify:
- [ ] No console errors about React hooks
- [ ] Toast notifications appear correctly
- [ ] Tooltips work on hover
- [ ] No blank screens on page load
- [ ] All interactive features work properly

## Troubleshooting

If you encounter React hook errors:
1. Check browser console for the specific hook causing issues
2. Verify the component isn't using `useToast` from the old system
3. Clear browser cache and hard refresh
4. Check Vite's dev server cache: `rm -rf node_modules/.vite`

## Additional Notes

- **Do not** reinstall or modify `@radix-ui/react-tooltip` provider
- **Do not** recreate the `use-toast.ts` hook
- Keep the no-op `TooltipProvider` wrapper in place
- When adding new toast notifications, always use Sonner

## Migration Progress

- [x] Core toast system removed
- [x] Sonner integrated in App.tsx
- [x] TooltipProvider wrapper created
- [ ] All components migrated to Sonner (58+ files)

---

Last updated: 2025-11-04
