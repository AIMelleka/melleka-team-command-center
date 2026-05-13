import { AnimatedSection } from "@/components/AnimatedSection";
import { Calendar, Rocket, Target, Crown } from "lucide-react";
import type { CSSProperties } from "react";
import { useAdminEdit } from '@/components/editor/AdminEditContext';
import { EditableContainer } from '@/components/editor/EditableContainer';
import { EditableText } from '@/components/editor/EditableText';

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
  const { isEditMode, hideSection, isSectionHidden } = useAdminEdit();

  if (!isEditMode && isSectionHidden('timeline')) return null;

  return (
    <section id="timeline" className="py-24" style={sectionStyle}>
      <EditableContainer sectionId="timeline" sectionName="Marketing Timeline" onDelete={() => hideSection('timeline')} onVisibilityToggle={() => hideSection('timeline')} isHidden={isSectionHidden('timeline')}>
      <div className="container max-w-6xl mx-auto px-4">
        <AnimatedSection>
          <div className="text-center mb-16">
            <EditableText
              value="Timeline"
              path="timeline.subtitle"
              as="p"
              className="font-medium uppercase tracking-widest text-sm mb-4"
              style={{ color: secondaryColor }}
            />
            <EditableText
              value="Project Timeline"
              path="timeline.title"
              as="h2"
              className="text-3xl md:text-5xl font-display font-bold mb-6"
              style={{ color: textColor }}
            />
            <EditableText
              value="A proven 12-month roadmap to build, optimize, and dominate your market."
              path="timeline.description"
              as="p"
              className="text-lg max-w-3xl mx-auto"
              style={{ color: textMutedColor }}
              multiline
            />
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
                  <EditableText
                    value={phase.name}
                    path={`timeline.phases.${i}.name`}
                    as="h4"
                    className="text-lg font-semibold mb-2"
                    style={{ color: textColor }}
                  />
                  <EditableText
                    value={phase.description}
                    path={`timeline.phases.${i}.description`}
                    as="p"
                    className="text-sm leading-relaxed"
                    style={{ color: textMutedColor }}
                    multiline
                  />
                </div>
              </AnimatedSection>
            );
          })}
        </div>
      </div>
      </EditableContainer>
    </section>
  );
}