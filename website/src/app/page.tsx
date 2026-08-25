import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import ProductLoop from "@/components/ProductLoop";
import GrowthShowcase from "@/components/GrowthShowcase";
import FeatureSection from "@/components/FeatureSection";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <ProductLoop />
        <GrowthShowcase />
        <FeatureSection />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
