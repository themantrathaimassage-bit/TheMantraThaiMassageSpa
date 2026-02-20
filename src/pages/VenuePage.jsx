import React, { useState, useEffect, useMemo, useCallback } from 'react';
import HeroSection from '../components/HeroSection';
import { venueData } from '../data/venueData';
import ServiceList from '../components/ServiceList';
import { servicesData } from '../data/servicesData';
import { fetchSquareServices } from '../data/squareCatalog';
import AboutSection from '../components/AboutSection';
import ReviewsSection from '../components/ReviewsSection';
import { reviewsData } from '../data/reviewsData';
import StickyBookingCard from '../components/StickyBookingCard';
import styles from './VenuePage.module.css';

import { useNavigate } from 'react-router-dom';
import { useSearch } from '../context/SearchContext';
import { useCart } from '../context/CartContext';

const VenuePage = () => {
    const [venue, setVenue] = useState(venueData);
    const [services, setServices] = useState(servicesData);
    const [servicesLoading, setServicesLoading] = useState(true);
    const [reviews, setReviews] = useState(reviewsData);

    const { searchQuery } = useSearch();
    const { addService } = useCart();
    const navigate = useNavigate();

    // Data Fetching with AbortController for cleanup
    useEffect(() => {
        const controller = new AbortController();
        setServicesLoading(true);

        // Fetch Services
        fetchSquareServices().then(live => {
            if (!controller.signal.aborted && live?.length > 0) setServices(live);
            setServicesLoading(false);
        }).catch(() => {
            if (!controller.signal.aborted) setServicesLoading(false);
        });

        // Fetch Reviews
        fetch('/api/reviews', { signal: controller.signal })
            .then(res => res.json())
            .then(data => {
                if (controller.signal.aborted) return;

                const list = Array.isArray(data) ? data : (data?.reviews || []);
                if (list.length > 0) setReviews(list);

                if (data?.rating) {
                    setVenue(prev => ({
                        ...prev,
                        rating: data.rating,
                        reviewCount: data.user_ratings_total
                    }));
                }
            })
            .catch(err => {
                if (err.name !== 'AbortError') console.error('Fetch reviews error:', err);
            });

        return () => controller.abort();
    }, []);

    const handleServiceSelect = useCallback((service) => {
        addService(service);
        navigate('/booking');
    }, [addService, navigate]);

    const filteredServices = useMemo(() => {
        if (!searchQuery) return services;
        const lower = searchQuery.toLowerCase();
        return services.map(cat => ({
            ...cat,
            items: cat.items.filter(item =>
                item.name.toLowerCase().includes(lower) ||
                (item.description && item.description.toLowerCase().includes(lower))
            )
        })).filter(cat => cat.items.length > 0);
    }, [searchQuery, services]);

    // Combined auto-scroll logic
    useEffect(() => {
        if (!searchQuery) return;
        const q = searchQuery.toLowerCase();

        let targetId = null;
        if (/opening|hour|time|close/.test(q)) targetId = 'opening-hours';
        else if (/location|map|address|where/.test(q)) targetId = 'location';
        else if (/review/.test(q)) targetId = 'reviews';
        else if (filteredServices.length > 0) targetId = 'services';

        if (targetId) {
            const el = document.getElementById(targetId);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: targetId === 'opening-hours' ? 'center' : 'start' });
        }
    }, [searchQuery, filteredServices]);

    return (
        <div className={styles.pageContainer}>
            <HeroSection venue={venue} />

            <div className={styles.contentGrid}>
                <main className={styles.mainContent}>
                    <section className={styles.sectionWrapper}>
                        <div id="services" style={{ scrollMarginTop: '140px' }}>
                            <ServiceList
                                services={filteredServices}
                                onServiceSelect={handleServiceSelect}
                                isSearching={!!searchQuery}
                                isLoading={servicesLoading}
                                buttonText="Book"
                            />
                        </div>
                    </section>

                    <hr className={styles.divider} />

                    <section className={styles.sectionWrapper}>
                        <div id="location" style={{ scrollMarginTop: '140px' }}>
                            <AboutSection venue={venue} />
                        </div>
                    </section>

                    <hr className={styles.divider} />

                    <section className={styles.sectionWrapper}>
                        <div id="reviews" style={{ scrollMarginTop: '140px' }}>
                            <ReviewsSection
                                reviews={reviews}
                                rating={venue.rating}
                                reviewCount={venue.reviewCount}
                            />
                        </div>
                    </section>
                </main>

                <aside className={styles.sidebar}>
                    <StickyBookingCard venue={venue} />
                </aside>
            </div>
        </div>
    );
};

export default React.memo(VenuePage);
