import { Badge } from "@/components/ui/badge";

interface VTCommunityBadgeProps {
  vtResidentCount: number;
}

export const VTCommunityBadge: React.FC<VTCommunityBadgeProps> = ({ vtResidentCount }) => {
  if (vtResidentCount <= 0) return null;

  return (
    <Badge
      className="bg-[#861F41] text-white font-semibold px-3 py-1 rounded-full shadow-md z-50"
    >
      {vtResidentCount} VT Resident{vtResidentCount > 1 ? "s" : ""}
    </Badge>
  );
};