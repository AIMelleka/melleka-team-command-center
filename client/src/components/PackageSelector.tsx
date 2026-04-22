import { useState } from 'react';
import { Check, X, ChevronDown, ChevronUp, Sparkles, ArrowRight, Clock, Layers, Star } from 'lucide-react';
import { MarketingPackage, MARKETING_PACKAGES, comparePackages, getPackagesByCategory } from '@/data/packages';

interface PackageSelectorProps {
  selectedPackages: string[];
  primaryPackage: string | null;
  onSelectPackages: (packages: string[], primary: string | null) => void;
}

const PackageSelector = ({ selectedPackages, primaryPackage, onSelectPackages }: PackageSelectorProps) => {
  const [showComparison, setShowComparison] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'advanced' | 'premium'>('premium');

  const handlePackageToggle = (packageId: string) => {
    const isSelected = selectedPackages.includes(packageId);
    
    if (isSelected) {
      // Remove package
      const newPackages = selectedPackages.filter(id => id !== packageId);
      // If we're removing the primary, set a new primary or null
      const newPrimary = packageId === primaryPackage 
        ? (newPackages.length > 0 ? newPackages[0] : null)
        : primaryPackage;
      onSelectPackages(newPackages, newPrimary);
    } else {
      // Add package
      const newPackages = [...selectedPackages, packageId];
      // If this is the first package, make it primary
      const newPrimary = primaryPackage || packageId;
      onSelectPackages(newPackages, newPrimary);
    }
  };

  const handleSetPrimary = (packageId: string) => {
    if (selectedPackages.includes(packageId)) {
      onSelectPackages(selectedPackages, packageId);
    }
  };

  // Get comparison between selected packages
  const getComparisonData = () => {
    if (selectedPackages.length < 2) return null;
    
    // Compare first two selected packages
    const [pkg1, pkg2] = selectedPackages;
    return comparePackages(pkg1, pkg2);
  };

  const comparison = getComparisonData();

  const categories: Array<{ id: 'advanced' | 'premium'; label: string; description: string }> = [
    { id: 'advanced', label: 'Advanced', description: 'Starting from $4,299/mo' },
    { id: 'premium', label: 'Premium', description: 'Starting from $7,499/mo' },
  ];

  const currentPackages = getPackagesByCategory(activeCategory);

  return (
    <div className="space-y-8">
      {/* Instructions */}
      <div className="text-center bg-genie-purple/10 rounded-xl p-4 max-w-2xl mx-auto">
        <p className="text-sm text-foreground">
          <strong>Select multiple packages</strong> to compare them, then choose your <span className="text-genie-gold">primary package</span> for the proposal.
        </p>
      </div>

      {/* Category Tabs */}
      <div className="flex justify-center">
        <div className="inline-flex bg-card rounded-2xl p-1.5 border border-border">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-6 py-3 rounded-xl text-sm font-medium transition-all ${
                activeCategory === cat.id
                  ? 'bg-genie-purple text-foreground shadow-lg'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="block">{cat.label}</span>
              <span className="text-xs opacity-70">{cat.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Package Cards */}
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {currentPackages.map((pkg) => (
          <PackageCard
            key={pkg.id}
            package={pkg}
            isSelected={selectedPackages.includes(pkg.id)}
            isPrimary={primaryPackage === pkg.id}
            onToggle={() => handlePackageToggle(pkg.id)}
            onSetPrimary={() => handleSetPrimary(pkg.id)}
            showPrimaryOption={selectedPackages.length > 1 && selectedPackages.includes(pkg.id)}
          />
        ))}
      </div>

      {/* Quick View All Packages */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-4">All Melleka Plans:</p>
        <div className="flex flex-wrap justify-center gap-2">
          {MARKETING_PACKAGES.map((pkg) => (
            <button
              key={pkg.id}
              onClick={() => {
                setActiveCategory(pkg.category);
                handlePackageToggle(pkg.id);
              }}
              className={`px-4 py-2 rounded-full text-sm transition-all ${
                selectedPackages.includes(pkg.id)
                  ? primaryPackage === pkg.id
                    ? 'bg-genie-gold text-genie-navy font-medium'
                    : 'bg-genie-purple text-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {pkg.name} - ${pkg.monthlyPrice.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      {/* Comparison Section */}
      {selectedPackages.length >= 2 && (
        <div className="genie-card p-4 rounded-xl max-w-4xl mx-auto">
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="w-full flex items-center justify-between text-foreground hover:text-genie-gold transition-colors"
          >
            <span className="font-medium flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-genie-gold" />
              Compare your {selectedPackages.length} selected packages
            </span>
            {showComparison ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </button>

          {showComparison && comparison && (
            <div className="mt-4 pt-4 border-t border-border">
              {/* Package Headers */}
              <div className="grid grid-cols-3 gap-4 text-sm font-medium text-muted-foreground border-b border-border pb-2 mb-2">
                <span>Feature</span>
                <span className="text-center">
                  {comparison.package1.name}
                  {primaryPackage === comparison.package1.id && (
                    <span className="ml-2 text-xs bg-genie-gold/20 text-genie-gold px-2 py-0.5 rounded-full">Primary</span>
                  )}
                </span>
                <span className="text-center">
                  {comparison.package2.name}
                  {primaryPackage === comparison.package2.id && (
                    <span className="ml-2 text-xs bg-genie-gold/20 text-genie-gold px-2 py-0.5 rounded-full">Primary</span>
                  )}
                </span>
              </div>
              
              <div className="max-h-96 overflow-y-auto space-y-2">
                {comparison.differences.map((diff, i) => (
                  <div 
                    key={i} 
                    className={`grid grid-cols-3 gap-4 text-sm py-2 rounded-lg px-2 ${
                      diff.upgradeValue && diff.inPackage2 !== 'Not included' 
                        ? 'bg-genie-purple/5' 
                        : diff.inPackage1 !== 'Not included' && diff.inPackage2 === 'Not included'
                          ? 'bg-destructive/5'
                          : ''
                    }`}
                  >
                    <span className="font-medium text-foreground">{diff.feature}</span>
                    <span className={`text-center ${
                      diff.inPackage1 !== 'Not included'
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    }`}>
                      {diff.inPackage1 === 'Not included' ? (
                        <X className="w-4 h-4 mx-auto text-destructive/70" />
                      ) : (
                        diff.inPackage1
                      )}
                    </span>
                    <span className={`text-center ${
                      diff.inPackage2 !== 'Not included'
                        ? 'text-genie-gold'
                        : 'text-muted-foreground'
                    }`}>
                      {diff.inPackage2 === 'Not included' ? (
                        <X className="w-4 h-4 mx-auto text-destructive/70" />
                      ) : (
                        diff.inPackage2
                      )}
                    </span>
                  </div>
                ))}
              </div>

              {/* Price Difference */}
              <div className="pt-4 border-t border-border flex items-center justify-between">
                <span className="text-muted-foreground">Monthly difference:</span>
                <span className={`font-bold ${
                  comparison.priceDifference > 0 ? 'text-genie-gold' : 'text-green-500'
                }`}>
                  {comparison.priceDifference > 0 ? '+' : ''}
                  ${comparison.priceDifference.toLocaleString()}/mo
                </span>
              </div>

              {/* Switch Primary Buttons */}
              <div className="mt-4 flex gap-3">
                {selectedPackages.slice(0, 2).map(pkgId => {
                  const pkg = MARKETING_PACKAGES.find(p => p.id === pkgId);
                  if (!pkg) return null;
                  return (
                    <button
                      key={pkgId}
                      onClick={() => handleSetPrimary(pkgId)}
                      className={`flex-1 py-2 rounded-xl font-medium transition-colors ${
                        primaryPackage === pkgId
                          ? 'bg-genie-gold text-genie-navy'
                          : 'border border-border text-foreground hover:bg-accent'
                      }`}
                    >
                      {primaryPackage === pkgId ? (
                        <>✓ {pkg.name} (Primary)</>
                      ) : (
                        <>Set {pkg.name} as Primary</>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Single package selected - show next tier comparison */}
      {selectedPackages.length === 1 && (
        <div className="genie-card p-4 rounded-xl max-w-4xl mx-auto">
          <p className="text-sm text-muted-foreground text-center">
            <Sparkles className="w-4 h-4 inline mr-1 text-genie-gold" />
            Select another package to compare what you'd get or lose
          </p>
        </div>
      )}
    </div>
  );
};

interface PackageCardProps {
  package: MarketingPackage;
  isSelected: boolean;
  isPrimary: boolean;
  onToggle: () => void;
  onSetPrimary: () => void;
  showPrimaryOption: boolean;
}

const PackageCard = ({ package: pkg, isSelected, isPrimary, onToggle, onSetPrimary, showPrimaryOption }: PackageCardProps) => {
  return (
    <div
      className={`relative rounded-2xl p-6 transition-all duration-300 ${
        isSelected
          ? isPrimary
            ? 'genie-card border-genie-gold ring-2 ring-genie-gold/50 scale-[1.02]'
            : 'genie-card border-genie-purple ring-2 ring-genie-purple/50'
          : 'genie-card hover:border-genie-purple/30 cursor-pointer'
      }`}
      onClick={() => !isSelected && onToggle()}
    >
      {/* Recommended Badge */}
      {pkg.recommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="px-3 py-1 bg-genie-purple text-xs font-bold text-white rounded-full flex items-center gap-1 whitespace-nowrap">
            <Sparkles className="w-3 h-3" />
            MOST POPULAR
          </span>
        </div>
      )}

      {/* Primary Badge */}
      {isPrimary && (
        <div className="absolute -top-3 right-4">
          <span className="px-3 py-1 bg-genie-gold text-genie-navy text-xs font-bold rounded-full flex items-center gap-1">
            <Star className="w-3 h-3" />
            PRIMARY
          </span>
        </div>
      )}

      {/* Selection Checkbox */}
      <div 
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className={`absolute top-4 right-4 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors cursor-pointer ${
          isSelected
            ? isPrimary 
              ? 'bg-genie-gold border-genie-gold'
              : 'bg-genie-purple border-genie-purple'
            : 'border-border hover:border-genie-purple'
        }`}
      >
        {isSelected && <Check className="w-4 h-4 text-foreground" />}
      </div>

      {/* Package Header */}
      <div className="flex items-start gap-4 mb-4">
        <div className="w-14 h-14 rounded-xl bg-genie-purple flex items-center justify-center flex-shrink-0">
          <span className="text-2xl font-bold text-white">{pkg.name.split(' ')[1]?.charAt(0) || pkg.tier}</span>
        </div>
        <div>
          <h3 className="text-xl font-display font-bold text-foreground">{pkg.name}</h3>
          <p className="text-sm text-genie-gold font-medium">{pkg.tagline}</p>
        </div>
      </div>

      {/* Price */}
      <div className="mb-4">
        <span className="text-3xl font-bold text-foreground">${pkg.monthlyPrice.toLocaleString()}</span>
        <span className="text-muted-foreground">/month</span>
      </div>

      {/* Key Info */}
      <div className="flex gap-4 mb-4 text-sm">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Layers className="w-4 h-4 text-genie-purple" />
          <span>{pkg.channels}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="w-4 h-4 text-genie-gold" />
          <span>{pkg.turnaround}</span>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-4">{pkg.description}</p>

      {/* Highlights */}
      <div className="space-y-2">
        {pkg.features.filter(f => f.included).slice(0, 4).map((feature, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <Check className="w-4 h-4 text-genie-gold flex-shrink-0" />
            <span className="text-foreground">{feature.name}</span>
            {feature.details && (
              <span className="text-muted-foreground text-xs">({feature.details})</span>
            )}
          </div>
        ))}
        {pkg.features.filter(f => !f.included).slice(0, 1).map((feature, i) => (
          <div key={i} className="flex items-center gap-2 text-sm opacity-50">
            <X className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-muted-foreground">{feature.name}</span>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="mt-6 space-y-2">
        {isSelected ? (
          <>
            {showPrimaryOption && !isPrimary && (
              <button
                onClick={(e) => { e.stopPropagation(); onSetPrimary(); }}
                className="w-full py-2 text-center rounded-lg bg-genie-gold/20 text-genie-gold font-medium hover:bg-genie-gold/30 transition-colors"
              >
                Set as Primary
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              className="w-full py-2 text-center rounded-lg bg-muted text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors text-sm"
            >
              Remove
            </button>
          </>
        ) : (
          <div className="py-2 text-center rounded-lg bg-muted text-muted-foreground">
            Click to Select
          </div>
        )}
      </div>
    </div>
  );
};

export default PackageSelector;
