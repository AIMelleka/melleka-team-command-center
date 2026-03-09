import { Layout, Utensils, Camera, Code, Building2, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface Template {
  id: string;
  name: string;
  description: string;
  icon: typeof Layout;
  prompt: string;
}

const TEMPLATES: Template[] = [
  {
    id: "business",
    name: "Business / Corporate",
    description: "Clean, professional multi-section landing page",
    icon: Building2,
    prompt: "Build a modern corporate business website with: a bold hero section with headline and CTA button, an about section, a services section with 4 service cards, a team section with 3 team member cards, a testimonials section, and a contact form. Use a professional blue color scheme.",
  },
  {
    id: "restaurant",
    name: "Restaurant / Food",
    description: "Menu, hours, reservation form, gallery",
    icon: Utensils,
    prompt: "Build a beautiful restaurant website with: a full-width hero image section, an about section, a menu section organized by categories (appetizers, mains, desserts, drinks) with prices, an hours & location section with a map placeholder, a photo gallery section, and a reservation form. Use warm, elegant colors.",
  },
  {
    id: "portfolio",
    name: "Portfolio / Creative",
    description: "Image grid, project showcase, about me",
    icon: Camera,
    prompt: "Build a stunning portfolio website for a creative professional with: a minimal hero with name and tagline, a filterable project gallery grid showing 6 projects with hover effects, an about section with skills list, a services section, testimonials, and a contact form. Use a dark modern theme with accent colors.",
  },
  {
    id: "saas",
    name: "SaaS / Tech",
    description: "Gradient hero, features, pricing, testimonials",
    icon: Code,
    prompt: "Build a modern SaaS landing page with: a gradient hero section with product headline, subtext, and two CTA buttons, a logos bar showing trusted by companies, a features section with 6 feature cards with icons, a how-it-works section with 3 steps, a pricing section with 3 tiers (Basic, Pro, Enterprise), testimonials, FAQ accordion, and a final CTA section. Use a purple/indigo gradient theme.",
  },
  {
    id: "medical",
    name: "Medical / Healthcare",
    description: "Services, team, appointment booking",
    icon: Stethoscope,
    prompt: "Build a professional healthcare/medical practice website with: a reassuring hero section with appointment CTA, a services section with 6 service cards, a doctors/team section with 4 profiles, a why choose us section, patient testimonials, an appointment booking form, insurance accepted section, and contact info with map. Use calming blue/teal medical colors.",
  },
  {
    id: "realestate",
    name: "Real Estate",
    description: "Property listings, search, agent profile",
    icon: Layout,
    prompt: "Build a real estate agent website with: a hero section with property search bar, a featured listings section with 6 property cards showing price/beds/baths, an about the agent section, services offered, recent sales stats, client testimonials, and a contact form. Use elegant dark theme with gold accents.",
  },
];

interface TemplateGalleryProps {
  open: boolean;
  onClose: () => void;
  onSelect: (template: Template) => void;
}

export default function TemplateGallery({ open, onClose, onSelect }: TemplateGalleryProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose a Template</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 max-h-[60vh] overflow-y-auto pr-1">
          {TEMPLATES.map((template) => {
            const Icon = template.icon;
            return (
              <button
                key={template.id}
                onClick={() => onSelect(template)}
                className="flex items-start gap-3 p-4 rounded-lg border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-colors text-left"
              >
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-medium">{template.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
                </div>
              </button>
            );
          })}
        </div>
        <div className="flex justify-end mt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
