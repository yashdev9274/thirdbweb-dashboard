import { MarketplaceV3 } from "@thirdweb-dev/sdk";
import { MarketplaceTable } from "contract-ui/tabs/shared-components/marketplace-table";
import { useState } from "react";
import { useReadContract } from "thirdweb/react";
import {
  getAllAuctions,
  getAllValidAuctions,
  totalAuctions,
} from "thirdweb/extensions/marketplace";
import { defineChain, getContract } from "thirdweb";
import { thirdwebClient } from "../../../../lib/thirdweb-client";

interface EnglishAuctionsTableProps {
  contract: MarketplaceV3;
}

const DEFAULT_QUERY_STATE = { count: 50, start: 0 };

export const EnglishAuctionsTable: React.FC<EnglishAuctionsTableProps> = ({
  contract: v4Contract,
}) => {
  const [queryParams, setQueryParams] = useState(DEFAULT_QUERY_STATE);
  const contract = getContract({
    client: thirdwebClient,
    address: v4Contract.getAddress(),
    chain: defineChain(v4Contract.chainId),
  });
  const getAllQueryResult = useReadContract(getAllAuctions, {
    contract,
    count: BigInt(queryParams.count),
    start: queryParams.start,
  });
  const getValidQueryResult = useReadContract(getAllValidAuctions, {
    contract,
    count: BigInt(queryParams.count),
    start: queryParams.start,
  });
  const totalCountQuery = useReadContract(totalAuctions, { contract });

  return (
    <MarketplaceTable
      contract={v4Contract}
      getAllQueryResult={getAllQueryResult}
      getValidQueryResult={getValidQueryResult}
      totalCountQuery={totalCountQuery}
      queryParams={queryParams}
      setQueryParams={setQueryParams}
      type="english-auctions"
    />
  );
};
