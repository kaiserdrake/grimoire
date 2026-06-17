'use client';

import { useState } from 'react';
import {
  Box, HStack, Text, Button, Tooltip, useToast,
  Slider, SliderTrack, SliderFilledTrack, SliderThumb,
  Popover, PopoverTrigger, PopoverContent, PopoverArrow, PopoverBody, Portal,
} from '@chakra-ui/react';
import { api } from '@/utils/api';
import { SATISFACTION_SCALE } from '@/constants/playthroughs';

const RATING_MIN = SATISFACTION_SCALE[0].value;
const RATING_MAX = SATISFACTION_SCALE[SATISFACTION_SCALE.length - 1].value;

function nearestSatisfaction(r) {
  return SATISFACTION_SCALE.reduce(
    (best, lvl) => (Math.abs(lvl.value - r) < Math.abs(best.value - r) ? lvl : best)
  );
}

// Compact slider; reports the value on release via onCommit.
function SatisfactionSlider({ initial, onCommit }) {
  const [value, setValue] = useState(initial);
  const nearest = nearestSatisfaction(value);

  return (
    <HStack spacing={2.5} align="center">
      <Slider
        flex="1"
        aria-label="Personal satisfaction rating"
        min={RATING_MIN} max={RATING_MAX} step={0.1} value={value}
        onChange={setValue}
        onChangeEnd={onCommit}
        focusThumbOnChange={false}
      >
        <SliderTrack bg="var(--color-bg-subtle)" h="4px" borderRadius="full">
          <SliderFilledTrack bg="var(--color-accent)" />
        </SliderTrack>
        <SliderThumb boxSize={3.5} bg="var(--color-accent)" />
      </Slider>
      <Text fontSize="0.7rem" fontWeight={700} color="var(--color-accent)" minW="56px" textAlign="right" whiteSpace="nowrap">
        {nearest.label}
      </Text>
    </HStack>
  );
}

// Pill that shows the current rating label and opens a compact slider popover.
export default function RatingPopover({ pt, onUpdated }) {
  const toast = useToast();
  const [rating, setRating] = useState(pt.rating == null ? 2 : Number(pt.rating));
  const label = nearestSatisfaction(rating).label;

  const commit = (val, onClose) => {
    const v = Math.round(val * 100) / 100;
    setRating(v);
    onClose?.(); // close the popover as soon as the value is set
    api.playthroughs.update(pt.id, { rating: v })
      .then(() => { pt.rating = v; onUpdated?.(); })
      .catch((err) => toast({ title: 'Error saving rating', description: err.message, status: 'error', duration: 3000 }));
  };

  return (
    <Popover placement="bottom-end" isLazy gutter={4}>
      {({ isOpen, onClose }) => (
        <>
          <Tooltip label="Personal rating" hasArrow placement="top" openDelay={400} isDisabled={isOpen}>
            <Box display="inline-flex">
              <PopoverTrigger>
                <Button
                  size="xs"
                  variant="outline"
                  height="20px"
                  px={2}
                  borderRadius="full"
                  fontSize="0.62rem"
                  fontWeight={700}
                  lineHeight={1}
                  whiteSpace="nowrap"
                  bg={isOpen ? 'var(--color-accent)' : 'var(--color-bg-subtle)'}
                  color={isOpen ? 'white' : 'var(--color-accent)'}
                  borderColor="var(--color-accent)"
                  _hover={{ bg: 'var(--color-accent)', color: 'white' }}
                >
                  {label}
                </Button>
              </PopoverTrigger>
            </Box>
          </Tooltip>
          <Portal>
            <PopoverContent
              w="190px"
              bg="var(--color-bg-surface)"
              borderColor="var(--color-border)"
              boxShadow="0 6px 20px rgba(0,0,0,0.28)"
              _focus={{ outline: 'none' }}
            >
              <PopoverArrow bg="var(--color-bg-surface)" />
              <PopoverBody px={2.5} py={2}>
                <SatisfactionSlider initial={rating} onCommit={(v) => commit(v, onClose)} />
              </PopoverBody>
            </PopoverContent>
          </Portal>
        </>
      )}
    </Popover>
  );
}
