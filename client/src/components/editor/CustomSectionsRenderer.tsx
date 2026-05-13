import { useAdminEdit, CustomProposalSection } from './AdminEditContext';
import { EditableContainer } from './EditableContainer';
import { EditableText } from './EditableText';
import { EditableList } from './EditableList';
import { AnimatedSection } from '@/components/AnimatedSection';
import { BarChart3, Quote, Megaphone } from 'lucide-react';

interface CustomSectionsRendererProps {
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  textMutedColor: string;
  cardBackground: string;
  borderColor: string;
  backgroundColor: string;
}

const TextBlockSection = ({ section, props }: { section: CustomProposalSection; props: CustomSectionsRendererProps }) => {
  const { updateCustomSection } = useAdminEdit();
  return (
    <div className="container max-w-6xl mx-auto px-4">
      <AnimatedSection>
        <h2 className="text-3xl md:text-4xl font-display font-bold mb-6" style={{ color: props.textColor }}>
          <EditableText
            value={section.title}
            path={`_customSections.${section.id}.title`}
            as="span"
            className="text-3xl md:text-4xl font-display font-bold"
            style={{ color: props.textColor }}
          />
        </h2>
        <EditableText
          value={(section.content.body as string) || 'Add content here...'}
          path={`_customSections.${section.id}.body`}
          as="p"
          className="text-lg leading-relaxed"
          style={{ color: props.textMutedColor }}
          multiline
        />
      </AnimatedSection>
    </div>
  );
};

const StatsSection = ({ section, props }: { section: CustomProposalSection; props: CustomSectionsRendererProps }) => {
  const stats = (section.content.stats as Array<{ value: string; label: string }>) || [];
  return (
    <div className="container max-w-6xl mx-auto px-4">
      <AnimatedSection>
        <h2 className="text-3xl md:text-4xl font-display font-bold mb-8 text-center" style={{ color: props.textColor }}>
          <EditableText
            value={section.title}
            path={`_customSections.${section.id}.title`}
            as="span"
            className="text-3xl md:text-4xl font-display font-bold"
            style={{ color: props.textColor }}
          />
        </h2>
        <div className={`grid grid-cols-1 md:grid-cols-${Math.min(stats.length, 4)} gap-6`}>
          {stats.map((stat, i) => (
            <div key={i} className="p-6 rounded-2xl text-center" style={{
              background: props.cardBackground,
              border: `1px solid ${props.borderColor}`
            }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3" style={{
                background: `color-mix(in srgb, ${props.primaryColor} 15%, transparent)`
              }}>
                <BarChart3 className="w-5 h-5" style={{ color: props.primaryColor }} />
              </div>
              <EditableText
                value={stat.value}
                path={`_customSections.${section.id}.stats.${i}.value`}
                as="p"
                className="text-3xl font-display font-bold mb-1"
                style={{ color: props.primaryColor }}
              />
              <EditableText
                value={stat.label}
                path={`_customSections.${section.id}.stats.${i}.label`}
                as="p"
                className="text-sm"
                style={{ color: props.textMutedColor }}
              />
            </div>
          ))}
        </div>
      </AnimatedSection>
    </div>
  );
};

const FeatureListSection = ({ section, props }: { section: CustomProposalSection; props: CustomSectionsRendererProps }) => {
  const items = (section.content.items as string[]) || [];
  return (
    <div className="container max-w-6xl mx-auto px-4">
      <AnimatedSection>
        <h2 className="text-3xl md:text-4xl font-display font-bold mb-8" style={{ color: props.textColor }}>
          <EditableText
            value={section.title}
            path={`_customSections.${section.id}.title`}
            as="span"
            className="text-3xl md:text-4xl font-display font-bold"
            style={{ color: props.textColor }}
          />
        </h2>
        <div className="p-8 rounded-3xl" style={{
          background: props.cardBackground,
          border: `1px solid ${props.borderColor}`
        }}>
          <EditableList
            items={items}
            basePath={`_customSections.${section.id}.items`}
            addLabel="Add feature"
            className="space-y-3"
            renderItem={(item, i) => (
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold" style={{
                  backgroundColor: props.primaryColor,
                  color: 'white'
                }}>{i + 1}</span>
                <span style={{ color: props.textColor }}>{item}</span>
              </div>
            )}
          />
        </div>
      </AnimatedSection>
    </div>
  );
};

const TestimonialSection = ({ section, props }: { section: CustomProposalSection; props: CustomSectionsRendererProps }) => (
  <div className="container max-w-4xl mx-auto px-4">
    <AnimatedSection>
      <div className="p-8 md:p-12 rounded-3xl text-center relative" style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${props.primaryColor} 8%, ${props.cardBackground}), ${props.cardBackground})`,
        border: `1px solid color-mix(in srgb, ${props.primaryColor} 20%, ${props.borderColor})`
      }}>
        <Quote className="w-10 h-10 mx-auto mb-6" style={{ color: props.primaryColor, opacity: 0.3 }} />
        <EditableText
          value={(section.content.quote as string) || '"Add testimonial..."'}
          path={`_customSections.${section.id}.quote`}
          as="p"
          className="text-xl md:text-2xl italic leading-relaxed mb-6"
          style={{ color: props.textColor }}
          multiline
        />
        <EditableText
          value={(section.content.author as string) || 'Author Name'}
          path={`_customSections.${section.id}.author`}
          as="p"
          className="font-display font-semibold text-lg"
          style={{ color: props.textColor }}
        />
        <EditableText
          value={(section.content.company as string) || 'Company'}
          path={`_customSections.${section.id}.company`}
          as="p"
          className="text-sm"
          style={{ color: props.textMutedColor }}
        />
      </div>
    </AnimatedSection>
  </div>
);

const CtaBlockSection = ({ section, props }: { section: CustomProposalSection; props: CustomSectionsRendererProps }) => (
  <div className="container max-w-4xl mx-auto px-4 text-center">
    <AnimatedSection>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{
        background: `linear-gradient(135deg, ${props.primaryColor}, ${props.secondaryColor})`
      }}>
        <Megaphone className="w-7 h-7 text-white" />
      </div>
      <EditableText
        value={(section.content.heading as string) || 'Ready to Get Started?'}
        path={`_customSections.${section.id}.heading`}
        as="h2"
        className="text-3xl md:text-4xl font-display font-bold mb-4"
        style={{ color: props.textColor }}
      />
      <EditableText
        value={(section.content.body as string) || 'Take the next step today.'}
        path={`_customSections.${section.id}.body`}
        as="p"
        className="text-lg mb-8"
        style={{ color: props.textMutedColor }}
        multiline
      />
      <a
        href={(section.content.buttonUrl as string) || '#'}
        className="inline-block px-8 py-4 rounded-xl font-semibold text-white transition-transform hover:scale-105"
        style={{ backgroundColor: props.primaryColor }}
      >
        {(section.content.buttonText as string) || 'Contact Us'}
      </a>
    </AnimatedSection>
  </div>
);

export const CustomSectionsRenderer = (props: CustomSectionsRendererProps) => {
  const { customSections, removeCustomSection, isEditMode } = useAdminEdit();

  if (customSections.length === 0) return null;

  const renderSection = (section: CustomProposalSection) => {
    switch (section.type) {
      case 'text-block': return <TextBlockSection section={section} props={props} />;
      case 'stats': return <StatsSection section={section} props={props} />;
      case 'feature-list': return <FeatureListSection section={section} props={props} />;
      case 'testimonial': return <TestimonialSection section={section} props={props} />;
      case 'cta-block': return <CtaBlockSection section={section} props={props} />;
      default: return null;
    }
  };

  return (
    <>
      {customSections.map((section) => (
        <section key={section.id} id={section.id} className="py-24" style={{ backgroundColor: props.backgroundColor }}>
          {isEditMode ? (
            <EditableContainer
              sectionId={section.id}
              sectionName={section.title}
              onDelete={() => removeCustomSection(section.id)}
            >
              {renderSection(section)}
            </EditableContainer>
          ) : (
            renderSection(section)
          )}
        </section>
      ))}
    </>
  );
};
