import { RefObject } from "react";

export const useDropdownPosition = (
    ref: RefObject<HTMLDivElement | null> | RefObject<HTMLDivElement>
) => {
    const getDropdownPosition = () => {
        if (!ref.current) return { top: 0, left: 0 };

        const rect = ref.current.getBoundingClientRect();
        const dropdownWidth = 240; // Width of dropdown w-60 = 15rem = 240px

        // Calculate initial position
        let left = rect.left + window.scrollX;
        const top = rect.bottom + window.scrollY;

        // Check if dropdown goes beyond the viewport width
        if (left + dropdownWidth > window.innerWidth) {
            // Adjust left position to fit within the viewport
            left = rect.right + window.scrollX - dropdownWidth;

            // If it still goes beyond the viewport, align to the right edge with padding
            if (left < 0) {
                left = window.innerWidth - dropdownWidth - 16; // 16px padding
            }
        }

        // Check if dropdown goes of left edge
        if (left < 0) {
            left = 16; // 16px padding from the left edge
        }

        return { top, left };
    };
    return {
        getDropdownPosition,
    };
};