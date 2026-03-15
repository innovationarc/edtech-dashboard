// src/components/ui/card/index.tsx
// Reads cardStyle from DashboardContext and renders the matching Card variant.
// Add new styles here — zero changes needed elsewhere in the app.
import { useDashboard } from '../../../contexts/DashboardContext';
import CardLiquid       from './CardLiquid';
import CardCrystal      from './CardCrystal';
import CardSolid        from './CardSolid';
import CardGlassmorphism from './CardGlassmorphism';
import CardVintage      from './CardVintage';
import CardNeon         from './CardNeon';
import CardFrost        from './CardFrost';
import CardMatte        from './CardMatte';

// Re-export props type from the default card so consumers can type-check
export type { default as CardProps } from './CardLiquid';

const CARDS: Record<string, React.ComponentType<any>> = {
  liquid:        CardLiquid,
  crystal:       CardCrystal,
  solid:         CardSolid,
  glassmorphism: CardGlassmorphism,
  vintage:       CardVintage,
  neon:          CardNeon,
  frost:         CardFrost,
  matte:         CardMatte,
};

const Card = (props: React.ComponentProps<typeof CardLiquid>) => {
  const { cardStyle = 'liquid' } = useDashboard();
  const Component = CARDS[cardStyle] ?? CardLiquid;
  return <Component {...props} />;
};

export default Card;
