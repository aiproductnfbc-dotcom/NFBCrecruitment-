import { Helmet } from 'react-helmet-async'
import Hero from '../../components/marketing/home/Hero'
import TrustBar from '../../components/marketing/home/TrustBar'
import ServicesGrid from '../../components/marketing/home/ServicesGrid'
import IndustriesGrid from '../../components/marketing/home/IndustriesGrid'
import HowWeWork from '../../components/marketing/home/HowWeWork'
import OpenRolesTeaser from '../../components/marketing/home/OpenRolesTeaser'
import NfrDifference from '../../components/marketing/home/NfrDifference'
import StatsBand from '../../components/marketing/home/StatsBand'
import SplitCta from '../../components/marketing/home/SplitCta'
import Testimonial from '../../components/marketing/home/Testimonial'

export default function HomePage() {
  return (
    <>
      <Helmet>
        <title>New Frontiers Talent | Specialist Recruitment Services</title>
        <meta
          name="description"
          content="Specialist recruitment services across multiple sectors. Permanent, contract, and executive search — backed by our own modern recruitment platform."
        />
        {/* OpenGraph + Twitter meta added more thoroughly in Batch 5 */}
      </Helmet>
      <Hero />
      <TrustBar />
      <ServicesGrid />
      <IndustriesGrid />
      <HowWeWork />
      <OpenRolesTeaser />
      <NfrDifference />
      <StatsBand />
      <SplitCta />
      <Testimonial />
    </>
  )
}
