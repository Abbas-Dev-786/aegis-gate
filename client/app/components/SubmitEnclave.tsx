interface SubmitEnclaveProps {
  submitToCRE: () => void;
  plaidToken: string;
}

export function SubmitEnclave({ submitToCRE, plaidToken }: SubmitEnclaveProps) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">
        4. Execute Private Settlement
      </label>
      <button
        onClick={submitToCRE}
        disabled={!plaidToken}
        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded disabled:opacity-50"
      >
        Submit to CRE Enclave
      </button>
    </div>
  );
}
