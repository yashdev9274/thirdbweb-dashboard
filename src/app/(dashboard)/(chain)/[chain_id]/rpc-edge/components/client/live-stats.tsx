"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { CircleCheck, XIcon } from "lucide-react";
import { ToolTipLabel } from "@/components/ui/tooltip";
import { CopyButton } from "@/components/ui/CopyButton";
import { PrimaryInfoItem } from "../../../components/server/primary-info-item";
import { useState } from "react";
import { thirdwebClient } from "lib/thirdweb-client";
import { hostnameEndsWith } from "utils/url";
import { isProd } from "constants/rpc";
import { useQuery } from "@tanstack/react-query";

function useChainStatswithRPC(_rpcUrl: string) {
  const [shouldRefetch, setShouldRefetch] = useState(true);

  let rpcUrl = _rpcUrl.replace(
    // eslint-disable-next-line no-template-curly-in-string
    "${THIRDWEB_API_KEY}",
    thirdwebClient.clientId,
  );

  // based on the environment hit dev or production
  if (hostnameEndsWith(rpcUrl, "rpc.thirdweb.com")) {
    if (!isProd) {
      rpcUrl = rpcUrl.replace("rpc.thirdweb.com", "rpc.thirdweb-dev.com");
    }
  }

  return useQuery({
    queryKey: ["chain-stats", { rpcUrl }],
    queryFn: async () => {
      const startTimeStamp = performance.now();
      const res = await fetch(rpcUrl, {
        method: "POST",
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 1,
        }),
      });

      const json = await res.json();
      const latency = (performance.now() - startTimeStamp).toFixed(0);

      return {
        latency,
        blockNumber: parseInt(json.result, 16),
      };
    },
    refetchInterval: shouldRefetch ? 5 * 1000 : undefined,
    enabled: !!rpcUrl,
    refetchOnWindowFocus: false,
    onError: () => {
      setShouldRefetch(false);
    },
  });
}

export function ChainLiveStats(props: { rpc: string }) {
  const stats = useChainStatswithRPC(props.rpc);

  return (
    <>
      {/* RPC URL */}
      <PrimaryInfoItem
        title="RPC"
        titleIcon={
          stats.isSuccess ? (
            <ToolTipLabel label="Working">
              <CircleCheck className="size-4 text-success-foreground" />
            </ToolTipLabel>
          ) : stats.isError ? (
            <ToolTipLabel label="Not Working">
              <XIcon className="size-4 text-destructive-foreground" />
            </ToolTipLabel>
          ) : null
        }
      >
        <div className="flex items-center gap-1">
          <div className="text-lg">{new URL(props.rpc).origin}</div>
          <CopyButton text={new URL(props.rpc).origin} />
        </div>
      </PrimaryInfoItem>

      {/* Latency */}
      <PrimaryInfoItem title="RPC Latency" titleIcon={<PulseDot />}>
        {stats.isError ? (
          <p className="text-lg fade-in-0 animate-in text-destructive-foreground">
            N/A
          </p>
        ) : stats.data ? (
          <p className="text-lg fade-in-0 animate-in">{stats.data.latency}ms</p>
        ) : (
          <div className="flex py-1 h-[28px] w-[70px]">
            <Skeleton className="h-full w-full" />
          </div>
        )}
      </PrimaryInfoItem>

      {/* Block Height */}
      <PrimaryInfoItem title="Block Height" titleIcon={<PulseDot />}>
        {stats.isError ? (
          <p className="text-lg fade-in-0 animate-in text-destructive-foreground">
            N/A
          </p>
        ) : stats.data ? (
          <p className="text-lg fade-in-0 animate-in">
            {stats.data.blockNumber}
          </p>
        ) : (
          <div className="flex py-1 h-[28px] w-[140px]">
            <Skeleton className="h-full w-full" />
          </div>
        )}
      </PrimaryInfoItem>
    </>
  );
}

function PulseDot() {
  return (
    <ToolTipLabel label={"Live Data"}>
      <span className="relative flex size-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full size-3 bg-primary"></span>
      </span>
    </ToolTipLabel>
  );
}
