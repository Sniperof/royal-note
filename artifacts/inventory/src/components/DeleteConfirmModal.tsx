import { motion, AnimatePresence } from "framer-motion";
import { Trash2, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useDeleteInventoryItem,
  getGetInventoryQueryKey,
  getSearchInventoryQueryKey
} from "@workspace/api-client-react";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: number | null;
  itemName?: string;
}

export function DeleteConfirmModal({ isOpen, onClose, itemId, itemName }: DeleteConfirmModalProps) {
  const queryClient = useQueryClient();
  
  const deleteMutation = useDeleteInventoryItem({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetInventoryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getSearchInventoryQueryKey() });
        onClose();
      }
    }
  });

  const handleDelete = async () => {
    if (itemId !== null) {
      await deleteMutation.mutateAsync({ id: itemId });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0.2 }}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col p-6"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                <Trash2 className="w-6 h-6" />
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-900 p-1 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <h2 className="text-xl font-bold text-gray-900 mb-2">Delete Product</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <span className="font-semibold text-gray-900">{itemName || "this item"}</span>? This action cannot be undone.
            </p>

            <div className="flex justify-end space-x-3 mt-auto">
              <button
                onClick={onClose}
                disabled={deleteMutation.isPending}
                className="px-5 py-2.5 rounded-xl text-gray-700 font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 shadow-lg shadow-red-600/20 hover:shadow-xl hover:shadow-red-600/30 hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:hover:transform-none flex items-center space-x-2"
              >
                {deleteMutation.isPending ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Yes, Delete</span>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
