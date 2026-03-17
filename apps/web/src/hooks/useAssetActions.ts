import { useMutation, useQueryClient } from "@tanstack/react-query";

type AssetMutationResponse = {
  id: string;
  is_favorite: boolean;
  tags: string[];
};

async function postFavorite(assetId: string): Promise<AssetMutationResponse> {
  const response = await fetch(`/api/asset/${assetId}/favorite`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Favorite update failed with ${response.status}`);
  }

  return (await response.json()) as AssetMutationResponse;
}

async function postTags(assetId: string, tags: string[]): Promise<AssetMutationResponse> {
  const response = await fetch(`/api/asset/${assetId}/tags`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tags }),
  });
  if (!response.ok) {
    throw new Error(`Tag update failed with ${response.status}`);
  }

  return (await response.json()) as AssetMutationResponse;
}

function invalidateMemoryQueries(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ["timeline"] });
  void queryClient.invalidateQueries({ queryKey: ["timeline-tags"] });
  void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postFavorite,
    onSuccess: () => {
      invalidateMemoryQueries(queryClient);
    },
  });
}

export function useUpdateAssetTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ assetId, tags }: { assetId: string; tags: string[] }) => postTags(assetId, tags),
    onSuccess: () => {
      invalidateMemoryQueries(queryClient);
    },
  });
}
