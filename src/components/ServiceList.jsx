import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import ServiceCard from './ServiceCard';
import styles from './ServiceList.module.css';

const ServiceList = ({ services, onServiceSelect, isSearching, hideSeeAll, isLoading, buttonText, selectedIds = [] }) => {
    const [activeCategory, setActiveCategory] = useState(services?.[0]?.category);
    const tabsRef = React.useRef(null);

    // Update active category when services change (e.g. after live fetch)
    React.useEffect(() => {
        if (services.length > 0) {
            setActiveCategory(prev => {
                const stillExists = services.some(g => g.category === prev);
                return stillExists ? prev : services[0].category;
            });
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

    // If searching, show all categories. Otherwise, filter by active tab.
    const displayServices = isSearching ? services : services.filter(group => group.category === activeCategory);

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
            {!isSearching && (
                <div className={styles.tabsContainer} ref={tabsRef}>
                    <div className={styles.tabsInner}>
                        {services.map((group) => (
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
                                    />
                                ))}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className={styles.noResults}>No services found matching your search.</div>
                )}
            </div>

            {!hideSeeAll && (
                <Link to="/booking" className={styles.seeAllBtn}>
                    See all services
                </Link>
            )}
        </div>
    );
};

export default ServiceList;
