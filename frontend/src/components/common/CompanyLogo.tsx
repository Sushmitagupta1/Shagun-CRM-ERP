import { useCompanyLogo } from '@/hooks/useCompanyLogo'

interface CompanyLogoProps {
  className?: string
}

export default function CompanyLogo({ className }: CompanyLogoProps) {
  const { logo, onError } = useCompanyLogo()
  return <img src={logo} alt="Shagun" className={className} onError={onError} />
}
