import { AnimatedSection } from "@/components/AnimatedSection";
import { Calendar, Rocket, Target, Crown } from "lucide-react";
import type { CSSProperties } from "react";

const FIXED_TIMELINE_PHASES = [
  {
    name: "Month 1-3: Marketing Foundation",
    icon: Rocket,
    description: "This is where we launch all the campaigns and start seeing results",
  },
  {
    name: "Month 4-7: Zero in & Retarget",
    icon: Target,
    description: "This is where our A/B tests start showing the winners and we lean into them",
  },
  {
    name: "Month 8-12: Brand Presence",
    icon: Crown,
    description: "This is where we are dominating and pumping out campaigns and completing tasks to stay ahead of the curve",
  },
];

interface MarketingTimelineSectionProps {
  sectionStyle: CSSProperties;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  textMutedColor: string;
  cardBackground: string;
  borderColor: string;
}

export function MarketingTimelineSection({
  sectionStyle,
  primaryColor,
  secondaryColor,
  textColor,
  textMutedColor,
  cardBackground,
  borderColor
}: MarketingTimelineSectionProps) {
  return (
    <section id="timeline" className="py-24" style={sectionStyle}>
      <div className="container max-w-6xl mx-auto px-4">
        <AnimatedSection>
          <div className="text-center mb-16">
            <p className="font-medium uppercase tracking-widest text-sm mb-4" style={{ color: secondaryColor }}>
              Timeline
            </p>
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-6" style={{ color: textColor }}>
              Project Timeline
            </h2>
            <p className="text-lg max-w-3xl mx-auto" style={{ color: textMutedColor }}>
              A proven 12-month roadmap to build, optimize, and dominate your market.
            </p>
          </div>
        </AnimatedSection>

        <div className="grid md:grid-cols-3 gap-8">
          {FIXED_TIMELINE_PHASES.map((phase, i) => {
            const Icon = phase.icon;
            return (
              <AnimatedSection key={i} delay={100 + i * 100}>
                <div
                  className="p-6 rounded-2xl h-full flex flex-col"
                  style={{ backgroundColor: cardBackground, border: `1px solid ${borderColor}` }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                    style={{ backgroundColor: `${primaryColor}20` }}
                  >
                    <Icon className="w-6 h-6" style={{ color: primaryColor }} />
                  </div>
                  <h4 className="text-lg font-semibold mb-2" style={{ color: textColor }}>
                    {phase.name}
                  </h4>
                  <p className="text-sm leading-relaxed" style={{ color: textMutedColor }}>
                    {phase.description}
                  </p>
                </div>
              </AnimatedSection>
            );
          })}
        </div>
      </div>
    </section>
  );
}