import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiChevronDown } from 'react-icons/fi';
import ServiceCard from './ServiceCard';
import AddonCard from './AddonCard';
import styles from './ServiceList.module.css';

// Detect if a category group is an "add-on" category
const isAddonGroup = (group) => {
    const name = group.category.toLowerCase();
    // Only match explicitly add-on category names
    const isNameMatch = name === 'add-ons' || name === 'add ons' || name === 'enhancements' ||
        name === 'enhancement' || name === 'upgrades' || name === 'upgrade';
    // Or if ALL items (and there are items) are flagged as addon
    const allAddons = group.items.length > 0 && group.items.every(s => s.isAddon);
    return isNameMatch || allAddons;
};

const ServiceList = ({ services, onServiceSelect, isSearching, hideSeeAll, isLoading, buttonText, selectedIds = [] }) => {
    const mainServices = services.filter(g => !isAddonGroup(g));
    const addonServices = services.filter(g => isAddonGroup(g));

    // Check if any selected item is a main (non-addon) service
    const allItems = services.flatMap(g => g.items || []);
    const hasMainService = allItems.some(s => !s.isAddon && s.variations?.some(v => selectedIds.includes(v.id)));

    const [activeCategory, setActiveCategory] = useState(mainServices?.[0]?.category);
    const [addonOpen, setAddonOpen] = useState(() => window.innerWidth > 768);
    const tabsRef = React.useRef(null);

    // Update active category when services change (e.g. after live fetch)
    React.useEffect(() => {
        if (mainServices.length > 0) {
            setActiveCategory(mainServices[0].category);
        }
    }, [services]);

    // Scroll active tab into view
    React.useEffect(() => {
        if (!isSearching && activeCategory) {
            const activeTab = tabsRef.current?.querySelector(`.${styles.tabActive}`);
            if (activeTab) {
                activeTab.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'center'
                });
            }
        }
    }, [activeCategory, isSearching]);

    const handleCategoryClick = (category) => {
        setActiveCategory(category);
    };

    // If searching, show all main categories. Otherwise, filter by active tab.
    const displayServices = isSearching
        ? mainServices
        : mainServices.filter(group => group.category === activeCategory);

    // Loading skeleton
    if (isLoading) {
        return (
            <div className={styles.container}>
                <div className={styles.loadingState}>
                    <div className={styles.skeletonTabs}>
                        {[1, 2, 3].map(i => <div key={i} className={styles.skeletonTab} />)}
                    </div>
                    {[1, 2].map(i => (
                        <div key={i} className={styles.skeletonCard}>
                            <div className={styles.skeletonHeader}>
                                <div className={styles.skeletonTitle} />
                                <div className={styles.skeletonPrice} />
                            </div>
                            <div className={styles.skeletonDesc} />
                            <div className={styles.skeletonAction} />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {!isSearching && mainServices.length > 0 && (
                <div className={styles.tabsContainer} ref={tabsRef}>
                    <div className={styles.tabsInner}>
                        {mainServices.map((group) => (
                            <button
                                key={group.category}
                                className={`${styles.categoryTab} ${activeCategory === group.category ? styles.tabActive : ''}`}
                                onClick={() => handleCategoryClick(group.category)}
                            >
                                {group.category}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className={styles.list}>
                {displayServices.length > 0 ? (
                    displayServices.map((group) => (
                        <div key={group.category} className={styles.categorySection}>
                            {isSearching && <h2 className={styles.categoryTitle}>{group.category}</h2>}
                            <div className={styles.serviceGrid}>
                                {group.items.map((service) => (
                                    <ServiceCard
                                        key={service.name}
                                        service={service}
                                        onSelect={onServiceSelect}
                                        buttonText={buttonText}
                                        selectedIds={selectedIds}
                                        hasMainService={hasMainService}
                                    />
                                ))}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className={styles.noResults}>No services found matching your search.</div>
                )}
            </div>

            {/* ── Add-on Section ── */}
            {addonServices.length > 0 && addonServices.some(g => g.items.length > 0) && (() => {
                const allAddonItems = addonServices.flatMap(g => g.items)
                    // Hide the overtime charge service — it's auto-added, not manually selectable
                    .filter(s => !s.name?.toLowerCase().includes('over time charge'));
                if (allAddonItems.length === 0) return null;
                const selectedCount = allAddonItems.filter(s =>
                    s.variations?.some(v => selectedIds.includes(v.id))
                ).length;
                return (
                    <div className={styles.addonSection}>
                        <button
                            className={styles.addonHeader}
                            onClick={() => setAddonOpen(p => !p)}
                        >
                            <span className={styles.addonTitle}>
                                Add-ons
                                {!addonOpen && selectedCount > 0 && (
                                    <span className={styles.addonBadge}>{selectedCount} selected</span>
                                )}
                            </span>
                            <FiChevronDown
                                size={16}
                                className={`${styles.addonChevron} ${addonOpen ? styles.addonChevronOpen : ''}`}
                            />
                        </button>
                        <div className={`${styles.addonGrid} ${addonOpen ? styles.addonGridOpen : styles.addonGridClosed}`}>
                            {allAddonItems.map((service) => (
                                <AddonCard
                                    key={service.name}
                                    service={service}
                                    onSelect={onServiceSelect}
                                    selectedIds={selectedIds}
                                />
                            ))}
                        </div>
                    </div>
                );
            })()}

            {!hideSeeAll && (
                <Link to="/booking" className={styles.seeAllBtn}>
                    See all services
                </Link>
            )}
        </div>
    );
};

export default ServiceList;


