import { FC, useContext, useEffect, useMemo, useState } from "react";
import { AddressAwareComponentProps } from "../types";
import ContentFrame from "../../components/ContentFrame";
import StandardSelectionBoundary from "../../selection/StandardSelectionBoundary";
import InfoRow from "../../components/InfoRow";
import AddressBalance from "./AddressBalance";
import TransactionAddressWithCopy from "../components/TransactionAddressWithCopy";
import TransactionLink from "../../components/TransactionLink";
import PendingResults from "../../search/PendingResults";
import ResultHeader from "../../search/ResultHeader";
import { SearchController } from "../../search/search";
import TransactionItem from "../../search/TransactionItem";
import UndefinedPageControl from "../../search/UndefinedPageControl";
import { useFeeToggler } from "../../search/useFeeToggler";
import { RuntimeContext } from "../../useRuntime";
import { useParams, useSearchParams } from "react-router-dom";
import { ProcessedTransaction } from "../../types";
import { useAddressBalance, useContractCreator } from "../../useErigonHooks";
import { BlockNumberContext } from "../../useBlockTagContext";

const AddressTransactionResults: FC<AddressAwareComponentProps> = ({
  address,
}) => {
  const { provider } = useContext(RuntimeContext);
  const [feeDisplay, feeDisplayToggler] = useFeeToggler();

  const { addressOrName, direction } = useParams();
  if (addressOrName === undefined) {
    throw new Error("addressOrName couldn't be undefined here");
  }

  const [searchParams] = useSearchParams();
  const hash = searchParams.get("h");

  const [controller, setController] = useState<SearchController>();
  useEffect(() => {
    if (!provider || !address) {
      return;
    }

    const readFirstPage = async () => {
      const _controller = await SearchController.firstPage(provider, address);
      setController(_controller);
    };
    const readMiddlePage = async (next: boolean) => {
      const _controller = await SearchController.middlePage(
        provider,
        address,
        hash!,
        next
      );
      setController(_controller);
    };
    const readLastPage = async () => {
      const _controller = await SearchController.lastPage(provider, address);
      setController(_controller);
    };
    const prevPage = async () => {
      const _controller = await controller!.prevPage(provider, hash!);
      setController(_controller);
    };
    const nextPage = async () => {
      const _controller = await controller!.nextPage(provider, hash!);
      setController(_controller);
    };

    // Page load from scratch
    if (direction === "first" || direction === undefined) {
      if (!controller?.isFirst || controller.address !== address) {
        readFirstPage();
      }
    } else if (direction === "prev") {
      if (controller && controller.address === address) {
        prevPage();
      } else {
        readMiddlePage(false);
      }
    } else if (direction === "next") {
      if (controller && controller.address === address) {
        nextPage();
      } else {
        readMiddlePage(true);
      }
    } else if (direction === "last") {
      if (!controller?.isLast || controller.address !== address) {
        readLastPage();
      }
    }
  }, [provider, address, direction, hash, controller]);

  const page = useMemo(() => controller?.getPage(), [controller]);

  const balance = useAddressBalance(provider, address);
  const creator = useContractCreator(provider, address);

  return (
    <ContentFrame tabs>
      <StandardSelectionBoundary>
        <BlockNumberContext.Provider value="latest">
          {balance && (
            <InfoRow title="Balance">
              <AddressBalance balance={balance} />
            </InfoRow>
          )}
          {creator && (
            <InfoRow title="Contract creator">
              <div className="flex divide-x-2 divide-dotted divide-gray-300">
                <TransactionAddressWithCopy
                  address={creator.creator}
                  showCodeIndicator
                />
                <div className="ml-3 flex items-baseline pl-3">
                  <TransactionLink txHash={creator.hash} />
                </div>
              </div>
            </InfoRow>
          )}
        </BlockNumberContext.Provider>
        <NavBar address={address} page={page} controller={controller} />
        <ResultHeader
          feeDisplay={feeDisplay}
          feeDisplayToggler={feeDisplayToggler}
        />
        {page ? (
          <>
            {page.map((tx) => (
              <TransactionItem
                key={tx.hash}
                tx={tx}
                selectedAddress={address}
                feeDisplay={feeDisplay}
              />
            ))}
            <NavBar address={address} page={page} controller={controller} />
          </>
        ) : (
          <PendingResults />
        )}
      </StandardSelectionBoundary>
    </ContentFrame>
  );
};

type NavBarProps = AddressAwareComponentProps & {
  page: ProcessedTransaction[] | undefined;
  controller: SearchController | undefined;
};

const NavBar: FC<NavBarProps> = ({ address, page, controller }) => (
  <div className="flex items-baseline justify-between py-3">
    <div className="text-sm text-gray-500">
      {page === undefined ? (
        <>Waiting for search results...</>
      ) : (
        <>{page.length} transactions on this page</>
      )}
    </div>
    <UndefinedPageControl
      address={address}
      isFirst={controller?.isFirst}
      isLast={controller?.isLast}
      prevHash={page?.[0]?.hash ?? ""}
      nextHash={page?.[page.length - 1]?.hash ?? ""}
      disabled={controller === undefined}
    />
  </div>
);

export default AddressTransactionResults;
