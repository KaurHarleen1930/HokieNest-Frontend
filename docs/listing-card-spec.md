# Listing Card Component Specification

## Design Tokens

### Colors
- **Primary Background**: `hsl(var(--surface))` - #15161A
- **Border**: `hsl(var(--surface-3))` - #1D1F24 with subtle borders
- **Text Primary**: `hsl(var(--foreground))` - #F5F7FA
- **Text Secondary**: `hsl(var(--muted))` - #A3A9B6
- **Accent**: `hsl(var(--accent))` - #F47C2A (price, badges)
- **Hover State**: Enhanced shadow and border accent

### Typography
- **Card Title**: 18px (text-lg), font-semibold (600), line-height 1.5
- **Price**: 24px (text-2xl), font-bold (700), accent color
- **Address**: 14px (text-sm), muted color, line-clamp-1
- **Badges/Chips**: 12px (text-xs), font-medium (500)

### Spacing
- **Card Padding**: 16px (p-4)
- **Vertical Spacing**: 12px between elements (space-y-3)
- **Badge Spacing**: 8px gaps between badges (gap-2)
- **Image Height**: 192px (h-48)

### Border Radius
- **Card**: 8px (rounded-lg)
- **Image**: Inherited from card with overflow hidden
- **Badges**: 4px (rounded-sm)
- **Button**: 6px (default rounded-md)

## Layout Structure

```
PropertyCard (rounded-lg, border, hover effects)
├── Image Container (relative, overflow-hidden)
│   ├── Property Image (h-48, object-cover, hover:scale-105)
│   └── International Badge (absolute, top-3, right-3)
├── Content Container (p-4, space-y-3)
│   ├── Title (font-semibold, text-lg, line-clamp-2)
│   ├── Price Row (flex, justify-between)
│   │   └── Price ($X,XXX/mo, text-2xl, font-bold, accent color)
│   ├── Address (text-muted, text-sm, line-clamp-1)
│   ├── Amenities Row (flex, gap-2, flex-wrap)
│   │   ├── Beds Chip (icon + text)
│   │   └── Baths Chip (icon + text)
│   └── CTA Button (full width, outline variant)
```

## Component States

### Default State
- Clean card with subtle border
- Hover transition ready
- All information clearly displayed

### Hover State
- Enhanced shadow (shadow-lg)
- Title color changes to accent
- Button border becomes accent colored
- Image scales slightly (scale-105)
- Smooth transitions (duration-normal)

### Loading State
- Skeleton placeholders for all elements
- Shimmer animation effect
- Maintains card dimensions

### International Friendly
- Orange accent badge with globe icon
- Positioned absolutely on image
- Visible shadow for contrast

## Responsive Behavior

### Mobile (< 768px)
- Single column grid
- Full width cards
- Touch-friendly button sizes
- Adequate spacing for finger taps

### Tablet (768px - 1024px)
- Two column grid
- Cards maintain aspect ratio
- Optimized spacing

### Desktop (> 1024px)
- Three column grid on properties page
- Consistent card heights
- Hover effects enabled

## Accessibility

### Screen Reader Support
- Proper alt text for images
- Descriptive button text
- Semantic HTML structure
- ARIA labels where needed

### Keyboard Navigation
- Focus visible ring
- Tab order follows visual flow
- Enter key activates buttons

### Color Contrast
- Minimum 4.5:1 contrast ratio
- High contrast for price and title
- Sufficient contrast for muted text

## Interactions

### Primary Action
- **Trigger**: Click "View Details" button or card click
- **Result**: Navigate to `/properties/{id}`
- **Visual**: Button hover state, potential card hover

### Secondary Actions
- **Save Property**: Heart icon (future feature)
- **Share**: Share icon (future feature)

## Data Requirements

### Required Fields
- `id`: Unique identifier
- `title`: Property name/title
- `price`: Monthly rent amount
- `address`: Property address
- `beds`: Number of bedrooms
- `baths`: Number of bathrooms
- `imageUrl`: Hero image URL
- `intlFriendly`: Boolean for international student support

### Optional Fields
- `description`: Detailed description
- `amenities`: Array of amenity strings
- `contactEmail`: Property contact email
- `contactPhone`: Property contact phone

## Performance Considerations

- Image lazy loading for viewport optimization
- Skeleton states for perceived performance
- Efficient re-rendering with React keys
- Optimized hover effects with GPU acceleration

## Testing Considerations

- `data-testid="listing-card"` on root element
- `data-testid="price"` on price element
- `data-testid="view-details"` on CTA button
- Accessibility testing with screen readers
- Cross-browser hover effect testing
- Mobile touch interaction testing